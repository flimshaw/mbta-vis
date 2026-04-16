import blessed from 'blessed';
import { showRouteSelector } from './overlays/route-selector.js';
import { showHelp } from './overlays/help.js';
import { COLORS } from './config.js';

let screen = null;
let tabBar = null;
let statusBar = null;
let tabs = []; // [{ label, view }]
let activeTabIndex = 0;
let cachedModes = []; // [{ label, routes: [{ id, name }] }]
let onRouteSelectCb = null;
let onDirectionToggleCb = null;
let onNewTabCb = null;
let onTabSwitchCb = null;
let onScrollCb = null;

/**
 * Initialize the blessed screen. Call once at startup.
 * @returns {object} blessed screen
 */
export function initScreen() {
  screen = blessed.screen({
    smartCSR: true,
    title: 'MBTA Visualizer',
    fullUnicode: true,
    forceUnicode: true,
    mouse: true,
  });

  tabBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: COLORS.activeBg },
  });

  statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: COLORS.statusBg, fg: COLORS.statusFg },
    content: ' [r] route  [n] new tab  [?] help  [q] quit',
  });

  tabBar.on('mousedown', (data) => {
    let pos = 0;
    for (let i = 0; i < tabs.length; i++) {
      const tabWidth = tabs[i].label.length + 2; // " label "
      if (data.x >= pos && data.x < pos + tabWidth) {
        setActiveTab(i);
        return;
      }
      pos += tabWidth + 1; // +1 for │ separator
    }
  });

  screen.append(tabBar);
  screen.append(statusBar);

  screen.key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });
  screen.key('r', () => showRouteSelector(screen, cachedModes, onRouteSelectCb));
  screen.key('n', () => { if (onNewTabCb) onNewTabCb(); });
  screen.key('d', () => { if (onDirectionToggleCb) onDirectionToggleCb(); });
  screen.key('?', () => showHelp(screen));
  screen.key(['up', 'k'], () => { if (onScrollCb) onScrollCb(-1); });
  screen.key(['down', 'j'], () => { if (onScrollCb) onScrollCb(1); });
  screen.key('pageup', () => { if (onScrollCb) onScrollCb(-10); });
  screen.key('pagedown', () => { if (onScrollCb) onScrollCb(10); });
  screen.key(['left', 'S-tab'], () => setActiveTab(activeTabIndex - 1));
  screen.key(['right', 'tab'], () => setActiveTab(activeTabIndex + 1));
  for (let i = 1; i <= 9; i++) {
    const idx = i - 1;
    screen.key(String(i), () => setActiveTab(idx));
  }

  screen.render();
  return screen;
}

export function getScreen() {
  return screen;
}

/**
 * Add a tab with an associated view.
 * @param {string} label - Tab label shown in the tab bar
 * @param {object} view - View object with a `box` property
 * @returns {number} Index of the new tab
 */
export function addTab(label, view) {
  if (tabs.length > 0) view.box.hide();

  screen.append(view.box);
  tabs.push({ label, view });
  renderTabBar();
  screen.render();
  return tabs.length - 1;
}

/**
 * Switch the active tab by index.
 */
export function setActiveTab(index) {
  if (index < 0 || index >= tabs.length) return;
  tabs[activeTabIndex].view.box.hide();
  activeTabIndex = index;
  tabs[activeTabIndex].view.box.show();
  renderTabBar();
  screen.render();
  if (onTabSwitchCb) onTabSwitchCb(activeTabIndex);
}

export function getActiveTabIndex() {
  return activeTabIndex;
}

export function updateTabLabel(index, label) {
  if (index >= 0 && index < tabs.length) {
    tabs[index].label = label;
    renderTabBar();
    screen.render();
  }
}

function renderTabBar() {
  const parts = tabs.map((t, i) =>
    i === activeTabIndex
      ? `{${COLORS.activeBg}-bg}{${COLORS.active}-fg} ${t.label} {/${COLORS.active}-fg}{/${COLORS.activeBg}-bg}`
      : `{${COLORS.inactive}-fg} ${t.label} {/${COLORS.inactive}-fg}`
  );
  tabBar.setContent(parts.join(`{${COLORS.inactive}-fg}│{/${COLORS.inactive}-fg}`));
}

/**
 * Update the status bar text (supports blessed tags).
 */
export function setStatus(text) {
  if (statusBar) {
    statusBar.setContent(` ${text}  {|}  [r] route  [n] new tab  [?] help  [q] quit`);
    screen.render();
  }
}

/**
 * Provide the list of routes for the route picker overlay.
 * @param {Array} modes - [{ label, routes: [{ id, name }] }]
 */
export function setRouteList(modes) {
  cachedModes = modes;
}

/**
 * Register a callback for when the user picks a route from the overlay.
 * @param {function} callback - Called with (routeId)
 */
export function onRouteSelect(callback) {
  onRouteSelectCb = callback;
}

export function onDirectionToggle(callback) {
  onDirectionToggleCb = callback;
}

export function onNewTab(callback) {
  onNewTabCb = callback;
}

export function onTabSwitch(callback) {
  onTabSwitchCb = callback;
}

export function onScroll(callback) {
  onScrollCb = callback;
}

/**
 * Look up a route name from the cached route list.
 * @param {string} routeId
 * @returns {string|null}
 */
export function getRouteName(routeId) {
  for (const mode of cachedModes) {
    for (const route of mode.routes) {
      if (route.id === routeId && route.name) {
        return route.name;
      }
    }
  }
  return null;
}

export function openRouteSelector() {
  showRouteSelector(screen, cachedModes, onRouteSelectCb);
}
