import { fetchRouteVehicles, fetchRouteStops, fetchBusRoutes, fetchSubwayRoutes, fetchStopsByIds, parseVehicle, parseStop } from './mbta-api.js';
import { initScreen, addTab, updateTabLabel, setStatus, setRouteList, onRouteSelect, onDirectionToggle, onNewTab, onTabSwitch, openRouteSelector, setActiveTab } from './screen.js';
import { createRouteView } from './views/route-view.js';

const AUTO_REFRESH_MS = 10000;
const DEFAULT_ROUTE = '87';
const DEFAULT_DIRECTION = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// Per-tab state: [{ tabIndex, route, direction, view, refreshTimer, countdownTimer, cachedStops, cachedStopsKey, lastStatus }]
const tabStates = [];
let activeTabIdx = 0;

function activeTab() {
  return tabStates[activeTabIdx];
}

// Whether the next route selection should open a new tab instead of switching the current one
let newTabPending = false;

async function getStops(tab, route, direction) {
  const key = `${route}:${direction}`;
  if (key !== tab.cachedStopsKey) {
    const raw = await fetchRouteStops(route, direction);
    tab.cachedStops = raw.map(parseStop).filter(Boolean);
    tab.cachedStopsKey = key;
  }
  return tab.cachedStops;
}

async function refreshAndDisplay(tab) {
  const isActive = tab === activeTab();
  if (isActive) setStatus(`{yellow-fg}Fetching Route ${tab.route}...{/yellow-fg}`);

  try {
    const [vehicles, stops] = await fetchWithRetry(() =>
      Promise.all([
        fetchRouteVehicles(tab.route, tab.direction),
        getStops(tab, tab.route, tab.direction),
      ])
    );

    const buses = vehicles.map(parseVehicle).filter(Boolean);

    const routeStopIds = new Set(stops.map(s => s.id));
    const unknownIds = [...new Set(
      buses.map(b => b.currentStopId).filter(id => id && !routeStopIds.has(id))
    )];
    const extraStops = unknownIds.length > 0
      ? (await fetchStopsByIds(unknownIds)).map(parseStop).filter(Boolean)
      : [];

    tab.view.update(buses, stops, extraStops, tab.direction, tab.route);
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
  const dir = tab.direction === 0 ? 'Outbound' : 'Inbound';
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

function switchRoute(routeId) {
  const tab = activeTab();
  tab.route = routeId;
  updateTabLabel(tab.tabIndex, `Route ${routeId}`);
  clearTimeout(tab.refreshTimer);
  clearInterval(tab.countdownTimer);
  refreshAndDisplay(tab);
}

function toggleDirection() {
  const tab = activeTab();
  tab.direction = tab.direction === 0 ? 1 : 0;
  clearTimeout(tab.refreshTimer);
  clearInterval(tab.countdownTimer);
  refreshAndDisplay(tab);
}

function createTab(routeId, direction) {
  const view = createRouteView();
  const tabIndex = addTab(`Route ${routeId}`, view);
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
  // Switch to the new tab
  activeTabIdx = tabStates.length - 1;
  setActiveTab(tabIndex);
  refreshAndDisplay(tab);
  return tab;
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

export async function main() {
  const args = process.argv.slice(2);
  const initialRoute = args[0] || DEFAULT_ROUTE;
  const initialDirection = args[1] !== undefined ? parseInt(args[1]) : DEFAULT_DIRECTION;

  initScreen();

  onRouteSelect(routeId => {
    if (newTabPending) {
      newTabPending = false;
      createTab(routeId, DEFAULT_DIRECTION);
    } else {
      switchRoute(routeId);
    }
  });

  onDirectionToggle(toggleDirection);

  onNewTab(() => {
    newTabPending = true;
    openRouteSelector();
  });

  onTabSwitch(index => {
    activeTabIdx = index;
    const tab = tabStates[index];
    if (tab?.lastStatus) setStatus(tab.lastStatus);
  });

  Promise.all([fetchBusRoutes(), fetchSubwayRoutes()])
    .then(([bus, subway]) => setRouteList([
      { label: 'Bus',    routes: bus    },
      { label: 'Subway', routes: subway },
    ]))
    .catch(() => {});

  createTab(initialRoute, initialDirection);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
