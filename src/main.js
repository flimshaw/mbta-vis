import { fetchBusRoutes, fetchSubwayRoutes } from './mbta-api.js';
import { initScreen, addTab, updateTabLabel, setStatus, setRouteList, onRouteSelect, onDirectionToggle, onNewTab, onTabSwitch, onScroll, openRouteSelector, setActiveTab, getRouteName } from './screen.js';
import { createRouteView } from './views/route-view.js';
import { DEFAULT_ROUTE, DEFAULT_DIRECTION } from './config.js';
import { createTabManager } from './tab-manager.js';

export async function main() {
  const args = process.argv.slice(2);
  const initialRoute = args[0] || DEFAULT_ROUTE;
  const initialDirection = args[1] !== undefined ? parseInt(args[1]) : DEFAULT_DIRECTION;

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
