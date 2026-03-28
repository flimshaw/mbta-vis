import blessed from 'blessed';

let screen = null;
let tabBar = null;
let statusBar = null;
let tabs = []; // [{ label, view }]
let activeTabIndex = 0;
let routeOverlay = null;
let helpOverlay = null;
let cachedRoutes = [];
let onRouteSelectCb = null;
let onDirectionToggleCb = null;

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
  });

  tabBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: 'black' },
  });

  statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: 'blue', fg: 'white' },
    content: ' [r] route  [?] help  [q] quit',
  });

  screen.append(tabBar);
  screen.append(statusBar);

  screen.key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });
  screen.key('r', () => showRouteOverlay());
  screen.key('d', () => { if (onDirectionToggleCb) onDirectionToggleCb(); });
  screen.key('?', () => showHelpOverlay());
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
      ? `{black-fg}{white-bg} ${t.label} {/white-bg}{/black-fg}`
      : `{grey-fg} ${t.label} {/grey-fg}`
  );
  tabBar.setContent(parts.join('{grey-fg}│{/grey-fg}'));
}

/**
 * Update the status bar text (supports blessed tags).
 */
export function setStatus(text) {
  if (statusBar) {
    statusBar.setContent(` ${text}  {|}  [r] route  [?] help  [q] quit`);
    screen.render();
  }
}

/**
 * Provide the list of routes for the route picker overlay.
 * @param {Array} routes - [{ id, name }]
 */
export function setRouteList(routes) {
  cachedRoutes = routes;
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

function showRouteOverlay() {
  if (routeOverlay) {
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
    return;
  }

  const routes = cachedRoutes.length > 0
    ? cachedRoutes
    : [{ id: '…', name: 'Loading routes…' }];

  routeOverlay = blessed.list({
    top: 'center',
    left: 'center',
    width: 46,
    height: Math.min(routes.length + 2, Math.floor(screen.height * 0.8)),
    border: { type: 'line' },
    label: ' Select Route (↑↓ navigate, Enter select) ',
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    style: { selected: { bg: 'blue', fg: 'white' }, border: { fg: 'cyan' } },
    items: routes.map(r => `  ${r.id.padEnd(6)} ${r.name}`),
  });

  routeOverlay.key(['escape', 'r'], () => {
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
  });

  routeOverlay.on('select', (_item, index) => {
    const route = routes[index];
    if (!route || route.id === '…') return;
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
    if (onRouteSelectCb) onRouteSelectCb(route.id);
  });

  screen.append(routeOverlay);
  routeOverlay.focus();
  screen.render();
}

function showHelpOverlay() {
  if (helpOverlay) {
    helpOverlay.destroy();
    helpOverlay = null;
    screen.render();
    return;
  }

  helpOverlay = blessed.box({
    top: 'center',
    left: 'center',
    width: 44,
    height: 16,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: 'yellow' } },
    content: [
      '',
      '  {bold}Keyboard Shortcuts{/bold}',
      '',
      '  {cyan-fg}r{/cyan-fg}       Open route selector',
      '  {cyan-fg}d{/cyan-fg}       Toggle inbound/outbound',
      '  {cyan-fg}?{/cyan-fg}       Toggle this help',
      '  {cyan-fg}← →{/cyan-fg}     Switch tabs',
      '  {cyan-fg}1-9{/cyan-fg}     Jump to tab',
      '  {cyan-fg}q{/cyan-fg}       Quit',
      '',
      '  {bold}Bus Status Icons{/bold}',
      '',
      '  {yellow-fg}■{/yellow-fg}  STOPPED_AT    {green-fg}▶{/green-fg}  IN_TRANSIT_TO',
      '  {cyan-fg}▷{/cyan-fg}  INCOMING_AT',
    ].join('\n'),
  });

  helpOverlay.key(['escape', '?'], () => {
    helpOverlay.destroy();
    helpOverlay = null;
    screen.render();
  });

  screen.append(helpOverlay);
  helpOverlay.focus();
  screen.render();
}
