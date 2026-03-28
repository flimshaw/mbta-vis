import { fetchRouteVehicles, fetchRouteStops, fetchBusRoutes, parseVehicle, parseStop } from './mbta-api.js';
import { initScreen, addTab, setStatus, setRouteList, onRouteSelect } from './screen.js';
import { createRouteView } from './views/route-view.js';

const AUTO_REFRESH_MS = 10000;
const DEFAULT_ROUTE = '87';
const DEFAULT_DIRECTION = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

let currentRoute = DEFAULT_ROUTE;
let currentDirection = DEFAULT_DIRECTION;
let activeView = null;
let refreshTimer = null;
let countdownTimer = null;

async function refreshAndDisplay() {
  setStatus(`{yellow-fg}Fetching Route ${currentRoute}...{/yellow-fg}`);

  try {
    const [vehicles, stops] = await fetchWithRetry(() =>
      Promise.all([
        fetchRouteVehicles(currentRoute, currentDirection),
        fetchRouteStops(currentRoute),
      ])
    );

    const buses = vehicles.map(parseVehicle).filter(Boolean);
    const parsedStops = stops.map(parseStop).filter(Boolean);

    activeView.update(buses, parsedStops, currentDirection, currentRoute);
    scheduleNextRefresh();

  } catch (error) {
    const msg = error.message.includes('rate limit')
      ? 'Rate limit exceeded — retrying soon'
      : `Error: ${error.message}`;
    setStatus(`{red-fg}${msg}{/red-fg}`);
    scheduleNextRefresh();
  }
}

function scheduleNextRefresh() {
  clearTimeout(refreshTimer);
  clearInterval(countdownTimer);

  let remaining = AUTO_REFRESH_MS / 1000;
  const dir = currentDirection === 0 ? 'Outbound' : 'Inbound';
  const statusText = () =>
    `Route {cyan-fg}${currentRoute}{/cyan-fg} ${dir} — refreshing in {white-fg}${remaining}s{/white-fg}`;

  setStatus(statusText());
  countdownTimer = setInterval(() => {
    remaining--;
    setStatus(statusText());
    if (remaining <= 0) clearInterval(countdownTimer);
  }, 1000);

  refreshTimer = setTimeout(() => {
    clearInterval(countdownTimer);
    refreshAndDisplay();
  }, AUTO_REFRESH_MS);
}

function switchRoute(routeId) {
  currentRoute = routeId;
  clearTimeout(refreshTimer);
  clearInterval(countdownTimer);
  refreshAndDisplay();
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
  currentRoute = args[0] || DEFAULT_ROUTE;
  currentDirection = args[1] !== undefined ? parseInt(args[1]) : DEFAULT_DIRECTION;

  initScreen();
  onRouteSelect(switchRoute);

  activeView = createRouteView();
  addTab(`Route ${currentRoute}`, activeView);

  fetchBusRoutes().then(setRouteList).catch(() => {});

  await refreshAndDisplay();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
