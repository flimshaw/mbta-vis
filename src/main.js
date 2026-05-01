import { fetchBusRoutes, fetchSubwayRoutes } from './mbta-api.js';
import { initScreen, addTab, updateTabLabel, setStatus, setRouteList, onRouteSelect, onDirectionToggle, onNewTab, onTabSwitch, onScroll, openRouteSelector, setActiveTab, getRouteName } from './screen.js';
import { createRouteView } from './views/route-view.js';
import { DEFAULT_ROUTE, DEFAULT_DIRECTION } from './config.js';
import { createTabManager } from './tab-manager.js';
import { THEME_NAME, OVERRIDE_THEME, getAvailableThemes } from './theme.js';

export async function main() {
  const args = process.argv.slice(2);

  // Parse --version flag
  if (args.includes('--version')) {
    console.log('mbta-vis v1.0.6');
    process.exit(0);
  }

  // Parse --theme flag for CLI override
  const themeIdx = args.indexOf('--theme');
  if (themeIdx !== -1) {
    const themeName = args[themeIdx + 1];
    if (!themeName || !getAvailableThemes().includes(themeName)) {
      console.error(`[MBTA Vis] Invalid theme "${themeName}". Available: ${getAvailableThemes().join(', ')}`);
      process.exit(1);
    }
  }

  const initialRoute = args[themeIdx !== -1 ? themeIdx + 2 : 0] || DEFAULT_ROUTE;
  const initialDirection = args[themeIdx !== -1 ? themeIdx + 3 : 1] !== undefined
    ? parseInt(args[themeIdx !== -1 ? themeIdx + 3 : 1])
    : DEFAULT_DIRECTION;

  // Log theme info
  console.error(`[MBTA Vis] Using theme: ${THEME_NAME}${OVERRIDE_THEME ? ` (override: ${OVERRIDE_THEME})` : ''}`);

  initScreen();

  const tm = createTabManager({
    createView: createRouteView,
    addTab,
    updateTabLabel,
    setStatus,
    setActiveTab,
    openRouteSelector,
    getRouteName,
  });

  onRouteSelect(routeId => tm.handleRouteSelect(routeId));
  onDirectionToggle(() => tm.toggleDirection());
  onNewTab(() => tm.requestNewTab());
  onScroll(delta => tm.scrollActive(delta));
  onTabSwitch(index => tm.switchTab(index));

  Promise.all([fetchBusRoutes(), fetchSubwayRoutes()])
    .then(([bus, subway]) => setRouteList([
      { label: 'Bus',    routes: bus    },
      { label: 'Subway', routes: subway },
    ]))
    .catch(() => {});

  tm.create(initialRoute, initialDirection);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
