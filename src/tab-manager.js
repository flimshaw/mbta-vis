import { fetchRouteVehicles, fetchRouteStops, fetchStopsByIds, fetchRoutePredictions, parseVehicle, parseStop } from './mbta-api.js';
import { AUTO_REFRESH_MS, MAX_RETRIES, RETRY_DELAY_MS, DIRECTION_LABELS, DEFAULT_DIRECTION } from './config.js';
import { groupPredictions, resolveUnknownStopIds, cacheKey } from './domain/route-data.js';
import { clearTimeout, setTimeout } from 'node:timers';

/**
 * Create a tab manager that owns all tab state and lifecycle.
 *
 * @param {object} deps
 * @param {function} deps.createView       - Factory: () => view object with .update() and .scroll()
 * @param {function} deps.addTab           - screen.addTab(label, view) → tabIndex
 * @param {function} deps.updateTabLabel   - screen.updateTabLabel(tabIndex, label)
 * @param {function} deps.setStatus        - screen.setStatus(text)
 * @param {function} deps.setActiveTab     - screen.setActiveTab(tabIndex)
 * @param {function} deps.openRouteSelector - screen.openRouteSelector()
 * @param {function} deps.getRouteName     - screen.getRouteName(routeId) → routeName or null
 * @returns {{ create, handleRouteSelect, requestNewTab, toggleDirection, switchTab, scrollActive }}
 */
export function createTabManager({ createView, addTab, updateTabLabel, setStatus, setActiveTab, openRouteSelector, getRouteName }) {
  // Per-tab state: [{ tabIndex, route, direction, view, refreshTimer, countdownTimer, cachedStops, cachedStopsKey, lastStatus }]
  const tabStates = [];
  let activeTabIdx = 0;
  let newTabPending = false;

  function activeTab() {
    return tabStates[activeTabIdx];
  }

  /** Format route label: use route name if available, otherwise show "Route X". */
  function formatRoute(routeId) {
    const routeName = getRouteName(routeId);
    return routeName || `Route ${routeId}`;
  }

  async function getStops(tab, route, direction) {
    const key = cacheKey(route, direction);
    if (key !== tab.cachedStopsKey) {
      const raw = await fetchRouteStops(route, direction);
      tab.cachedStops = raw.map(parseStop).filter(Boolean);
      tab.cachedStopsKey = key;
    }
    return tab.cachedStops;
  }

  async function refreshAndDisplay(tab) {
    const isActive = tab === activeTab();
    if (isActive) setStatus(`{yellow-fg}Fetching ${formatRoute(tab.route)}...{/yellow-fg}`);

    try {
      const [vehicles, stops, rawPredictions] = await fetchWithRetry(() =>
        Promise.all([
          fetchRouteVehicles(tab.route, tab.direction),
          getStops(tab, tab.route, tab.direction),
          fetchRoutePredictions(tab.route, tab.direction),
        ])
      );

      const buses = vehicles.map(parseVehicle).filter(Boolean);
      const unknownIds = resolveUnknownStopIds(buses, rawPredictions, stops);
      const extraStops = unknownIds.length > 0
        ? (await fetchStopsByIds(unknownIds)).map(parseStop).filter(Boolean)
        : [];
      const predictions = groupPredictions(rawPredictions);

      tab.view.update(buses, stops, extraStops, tab.direction, tab.route, predictions);
      scheduleNextRefresh(tab);

    } catch (error) {
      const msg = error.message.includes('rate limit')
        ? 'Rate limit exceeded — retrying soon'
        : `Error: ${error.message}`;
      const statusText = `{red-fg}${msg}{/red-fg}`;
      tab.lastStatus = statusText;
      if (tab === activeTab()) setStatus(statusText);
      scheduleNextRefresh(tab);
    }
  }

  function scheduleNextRefresh(tab) {
    clearTimeout(tab.refreshTimer);
    clearInterval(tab.countdownTimer);

    let remaining = AUTO_REFRESH_MS / 1000;
    const dir = DIRECTION_LABELS[tab.direction];
    const statusText = () =>
      `Route {cyan-fg}${tab.route}{/cyan-fg} ${dir} — refreshing in {white-fg}${remaining}s{/white-fg}`;

    tab.lastStatus = statusText();
    if (tab === activeTab()) setStatus(tab.lastStatus);

    tab.countdownTimer = setInterval(() => {
      remaining--;
      tab.lastStatus = statusText();
      if (tab === activeTab()) setStatus(tab.lastStatus);
      if (remaining <= 0) clearInterval(tab.countdownTimer);
    }, 1000);

    tab.refreshTimer = setTimeout(() => {
      clearInterval(tab.countdownTimer);
      refreshAndDisplay(tab);
    }, AUTO_REFRESH_MS);
  }

  function cancelTimers(tab) {
    clearTimeout(tab.refreshTimer);
    clearInterval(tab.countdownTimer);
  }

  return {
    /** Create a new tab for the given route and direction, and start fetching. */
    create(routeId, direction) {
      const view = createView();
      const tabIndex = addTab(formatRoute(routeId), view);
      const tab = {
        tabIndex,
        route: routeId,
        direction,
        view,
        refreshTimer: null,
        countdownTimer: null,
        cachedStops: [],
        cachedStopsKey: '',
        lastStatus: '',
      };
      tabStates.push(tab);
      activeTabIdx = tabStates.length - 1;
      setActiveTab(tabIndex);
      refreshAndDisplay(tab);
      return tab;
    },

    /** Switch the active tab's route, cancel pending refresh, and re-fetch. */
    switchRoute(routeId) {
      const tab = activeTab();
      tab.route = routeId;
      updateTabLabel(tab.tabIndex, formatRoute(routeId));
      cancelTimers(tab);
      refreshAndDisplay(tab);
    },

    /** Toggle direction on the active tab and re-fetch. */
    toggleDirection() {
      const tab = activeTab();
      tab.direction = tab.direction === 0 ? 1 : 0;
      cancelTimers(tab);
      refreshAndDisplay(tab);
    },

    /**
     * Handle a route selection from the overlay.
     * If a new tab was requested, creates one; otherwise switches the current tab's route.
     */
    handleRouteSelect(routeId) {
      if (newTabPending) {
        newTabPending = false;
        this.create(routeId, DEFAULT_DIRECTION);
      } else {
        this.switchRoute(routeId);
      }
    },

    /** Flag the next route selection to open in a new tab, then open the selector. */
    requestNewTab() {
      newTabPending = true;
      openRouteSelector();
    },

    /** Called when the user switches tabs (by key or click). Restores the tab's status. */
    switchTab(index) {
      activeTabIdx = index;
      const tab = tabStates[index];
      if (tab?.lastStatus) setStatus(tab.lastStatus);
    },

    /** Scroll the active tab's view. */
    scrollActive(delta) {
      activeTab()?.view.scroll(delta);
    },
  };
}

async function fetchWithRetry(fetchFn) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
