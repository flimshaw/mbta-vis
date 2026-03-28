import blessed from 'blessed';

let screen = null;
let tabBar = null;
let statusBar = null;
let tabs = []; // [{ label, view }]
let activeTabIndex = 0;
let routeOverlay = null;
let helpOverlay = null;
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
  screen.key('n', () => { if (onNewTabCb) onNewTabCb(); });
  screen.key('d', () => { if (onDirectionToggleCb) onDirectionToggleCb(); });
  screen.key('?', () => showHelpOverlay());
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

export function openRouteSelector() {
  showRouteOverlay();
}


function buildModeLabel(modes, activeModeIdx) {
  const parts = modes.map((m, i) =>
    i === activeModeIdx
      ? `{black-fg}{white-bg} ${m.label} {/white-bg}{/black-fg}`
      : `{grey-fg} ${m.label} {/grey-fg}`
  );
  return ` ${parts.join('')} `;
}

function showRouteOverlay() {
  if (routeOverlay) {
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
    return;
  }

  // Build modes array; fall back to a loading placeholder
  const modes = cachedModes.length > 0
    ? cachedModes
    : [{ label: 'Routes', routes: [{ id: '…', name: 'Loading routes…' }] }];

  let activeModeIdx = 0;
  const currentRoutes = () => modes[activeModeIdx].routes;
  const fmtItem = r => `  ${r.id.padEnd(6)} ${r.name}`;

  const maxHeight = Math.floor(screen.height * 0.8);
  routeOverlay = blessed.list({
    top: 'center',
    left: 'center',
    width: 50,
    height: maxHeight,
    border: { type: 'line' },
    label: buildModeLabel(modes, activeModeIdx),
    tags: true,
    mouse: true,
    style: { selected: { bg: 'blue', fg: 'white' }, border: { fg: 'cyan' } },
    items: currentRoutes().map(fmtItem),
  });

  const closeRouteOverlay = () => {
    if (!routeOverlay) return;
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
  };

  const switchMode = (delta) => {
    activeModeIdx = (activeModeIdx + delta + modes.length) % modes.length;
    routeOverlay.setLabel(buildModeLabel(modes, activeModeIdx));
    routeOverlay.setItems(currentRoutes().map(fmtItem));
    routeOverlay.select(0);
    screen.render();
  };

  routeOverlay.key(['escape', 'r'], closeRouteOverlay);
  routeOverlay.key('left', () => switchMode(-1));
  routeOverlay.key('right', () => switchMode(1));

  const overlayPageSize = Math.max(1, maxHeight - 2);
  routeOverlay.key('pageup', () => {
    const i = routeOverlay.selected;
    routeOverlay.select(Math.max(0, i - overlayPageSize));
    screen.render();
  });
  routeOverlay.key('pagedown', () => {
    const i = routeOverlay.selected;
    routeOverlay.select(Math.min(currentRoutes().length - 1, i + overlayPageSize));
    screen.render();
  });
  routeOverlay.key(['up', 'k'], () => {
    const routes = currentRoutes();
    const i = routeOverlay.selected;
    routeOverlay.select(i <= 0 ? routes.length - 1 : i - 1);
    screen.render();
  });
  routeOverlay.key(['down', 'j'], () => {
    const routes = currentRoutes();
    const i = routeOverlay.selected;
    routeOverlay.select(i >= routes.length - 1 ? 0 : i + 1);
    screen.render();
  });
  routeOverlay.key(['enter', 'return'], () => {
    const route = currentRoutes()[routeOverlay.selected];
    if (!route || route.id === '…') return;
    closeRouteOverlay();
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
    height: 18,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: 'yellow' } },
    content: [
      '',
      '  {bold}Keyboard Shortcuts{/bold}',
      '',
      '  {cyan-fg}n{/cyan-fg}       New tab',
      '  {cyan-fg}r{/cyan-fg}       Open route selector',
      '  {cyan-fg}d{/cyan-fg}       Toggle inbound/outbound',
      '  {cyan-fg}↑↓ / j k{/cyan-fg} Scroll stops list',
      '  {cyan-fg}PgUp/Dn{/cyan-fg} Scroll stops by 10',
      '  {cyan-fg}?{/cyan-fg}       Toggle this help',
      '  {cyan-fg}← →{/cyan-fg}     Switch tabs (or mode in selector)',
      '  {cyan-fg}1-9{/cyan-fg}     Jump to tab',
      '  {cyan-fg}q{/cyan-fg}       Quit',
      '',
      '  {bold}Bus Status Icons{/bold}',
      '',
      '  {yellow-fg}■{/yellow-fg}  STOPPED_AT    {green-fg}▶{/green-fg}  IN_TRANSIT_TO',
      '  {cyan-fg}▷{/cyan-fg}  INCOMING_AT',
    ].join('\n'),
  });

  const closeHelpOverlay = () => {
    if (!helpOverlay) return;
    helpOverlay.destroy();
    helpOverlay = null;
    screen.render();
  };

  helpOverlay.key(['escape', '?'], closeHelpOverlay);

  screen.append(helpOverlay);
  helpOverlay.focus();
  screen.render();
}
