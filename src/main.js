import { fetchRouteVehicles, fetchRouteStops, fetchBusRoutes, parseVehicle, parseStop } from './mbta-api.js';
import { initScreen, renderVisualization, setStatus, setRouteList } from './visualizer.js';

const AUTO_REFRESH_MS = 10000;
const DEFAULT_ROUTE = '87';
const DEFAULT_DIRECTION = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

let currentRoute = DEFAULT_ROUTE;
let currentDirection = DEFAULT_DIRECTION;
let refreshTimer = null;
let countdownTimer = null;

/**
 * Fetch and render MBTA data for a route
 */
async function refreshAndDisplay() {
  setStatus(`{yellow-fg}Fetching Route ${currentRoute}...{/yellow-fg}`);

  try {
    const [vehicles, stops] = await fetchWithRetry(
      () => Promise.all([
        fetchRouteVehicles(currentRoute, currentDirection),
        fetchRouteStops(currentRoute)
      ])
    );

    const parsedVehicles = vehicles.map(parseVehicle).filter(v => v !== null);
    const parsedStops = stops.map(parseStop).filter(s => s !== null);

    renderVisualization(parsedVehicles, parsedStops, currentDirection, currentRoute);
    scheduleNextRefresh();

  } catch (error) {
    const msg = error.message.includes('rate limit')
      ? 'Rate limit exceeded — retrying soon'
      : `Error: ${error.message}`;
    setStatus(`{red-fg}${msg}{/red-fg}`);
    scheduleNextRefresh();
  }
}

/**
 * Schedule the next refresh with a countdown in the status bar
 */
function scheduleNextRefresh() {
  clearTimeout(refreshTimer);
  clearInterval(countdownTimer);

  let remaining = AUTO_REFRESH_MS / 1000;
  const dir = currentDirection === 0 ? 'Outbound' : 'Inbound';
  setStatus(`Route {cyan-fg}${currentRoute}{/cyan-fg} ${dir} — refreshing in {white-fg}${remaining}s{/white-fg}`);

  countdownTimer = setInterval(() => {
    remaining--;
    setStatus(`Route {cyan-fg}${currentRoute}{/cyan-fg} ${dir} — refreshing in {white-fg}${remaining}s{/white-fg}`);
    if (remaining <= 0) clearInterval(countdownTimer);
  }, 1000);

  refreshTimer = setTimeout(() => {
    clearInterval(countdownTimer);
    refreshAndDisplay();
  }, AUTO_REFRESH_MS);
}

/**
 * Switch to a new route (called from the route overlay)
 */
function switchRoute(routeNumber, directionId = currentDirection) {
  currentRoute = routeNumber;
  currentDirection = directionId;
  clearTimeout(refreshTimer);
  clearInterval(countdownTimer);
  refreshAndDisplay();
}

/**
 * Fetch with retry logic
 */
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

/**
 * Main CLI application
 */
export async function main() {
  const args = process.argv.slice(2);
  currentRoute = args[0] || DEFAULT_ROUTE;
  currentDirection = args[1] !== undefined ? parseInt(args[1]) : DEFAULT_DIRECTION;

  initScreen((routeNumber) => switchRoute(routeNumber));

  // Fetch route list in background — overlay will use it once ready
  fetchBusRoutes().then(setRouteList).catch(() => {});

  await refreshAndDisplay();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
