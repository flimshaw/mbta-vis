import { fetchRouteVehicles, fetchRouteStops, parseVehicle, parseStop } from './mbta-api.js';
import { renderVisualization } from './visualizer.js';

const AUTO_REFRESH_MS = 10000; // Disable auto-refresh for debugging
const DEFAULT_ROUTE = '87';
const DEFAULT_DIRECTION = 0; // 0 = outbound, 1 = inbound
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Fetch and display MBTA data for a route
 * @param {string} routeNumber - Route number
 * @param {number} directionId - Direction ID (0 or 1)
 * @returns {Promise<boolean>} - Whether to continue running
 */
async function refreshAndDisplay(routeNumber, directionId) {
  try {
    const [vehicles, stops] = await fetchWithRetry(
      () => Promise.all([
        fetchRouteVehicles(routeNumber, directionId),
        fetchRouteStops(routeNumber)
      ]),
      'Failed to fetch MBTA data'
    );

    const parsedVehicles = vehicles
      .map(parseVehicle)
      .filter(v => v !== null);

    const parsedStops = stops
      .map(parseStop)
      .filter(s => s !== null);

    // Handle no buses scenario
    if (parsedVehicles.length === 0) {
      console.log(`No active buses on Route ${routeNumber}`);
      console.log('Buses may not be running at this time.');
      console.log('');
      return true; // Continue running
    }

    // Handle stale data
    const oldestUpdate = getOldestUpdateTimestamp(parsedVehicles);
    if (oldestUpdate) {
      const timeAgo = getTimeAgo(oldestUpdate);
      const isStale = timeAgo > 5 * 60 * 1000; // More than 5 minutes old
      if (isStale) {
        console.log(`Warning: Data may be stale (${timeAgo} ago)\n`);
      }
    }

    const visualization = renderVisualization(parsedVehicles, parsedStops, directionId, routeNumber);
    console.log(visualization);
    return true;

  } catch (error) {
    handleMainError(error);
    return false;
  }
}

/**
 * Main CLI application
 */
export async function main() {
  // Parse command-line arguments (skip 'node' and script name)
  const args = process.argv.slice(2);
  const routeNumber = args[0] || DEFAULT_ROUTE;
  const directionId = args[1] !== undefined ? parseInt(args[1]) : DEFAULT_DIRECTION;
  
  console.log('\x1b[2J\x1b[0f'); // Clear screen
  console.log(`Loading MBTA Route ${routeNumber} data...\n`);

  // Initial load
  const shouldContinue = await refreshAndDisplay(routeNumber, directionId);
  
  if (!shouldContinue) {
    return;
  }

  if (AUTO_REFRESH_MS > 0) {
    console.log(`\nAuto-refresh in ${AUTO_REFRESH_MS / 1000} seconds (Ctrl+C to exit)`);
    
    // Continuous auto-refresh loop
    while (true) {
      // Wait for auto-refresh interval
      let remaining = AUTO_REFRESH_MS / 1000;
      const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(timer);
        } else {
          process.stdout.write(`\rRefreshing in ${remaining}s...   `);
        }
      }, 1000);

      // Wait for the interval to complete
      await new Promise(resolve => setTimeout(resolve, AUTO_REFRESH_MS));
      clearInterval(timer);
      
      // Clear screen and refresh
      console.log('\x1b[2J\x1b[0f');
      console.log(`Refreshing MBTA Route ${routeNumber} data...\n`);
      
      const shouldContinue = await refreshAndDisplay(routeNumber, directionId);
      if (!shouldContinue) {
        break;
      }
      
      console.log(`\nAuto-refresh in ${AUTO_REFRESH_MS / 1000} seconds (Ctrl+C to exit)`);
    }
  }
}

/**
 * Fetch with retry logic for transient errors
 * @param {Function} fetchFn - Async function to execute
 * @returns {Promise<any>} - Result of fetch function
 */
async function fetchWithRetry(fetchFn) {
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      
      if (error.message.includes('rate limit')) {
        console.error(`API rate limit exceeded. Retrying in ${RETRY_DELAY_MS / 1000} seconds... (attempt ${attempt}/${MAX_RETRIES})`);
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error(`Network error. Retrying... (attempt ${attempt}/${MAX_RETRIES})`);
      } else if (error.message.includes('429')) {
        console.error(`Rate limited. Waiting before retry... (attempt ${attempt}/${MAX_RETRIES})`);
      }
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the oldest update timestamp from vehicles
 * @param {Array} vehicles - Array of parsed vehicle objects
 * @returns {string|null} - ISO timestamp or null
 */
function getOldestUpdateTimestamp(vehicles) {
  if (!vehicles || vehicles.length === 0) {
    return null;
  }
  
  const timestamps = vehicles
    .map(v => v.lastUpdated)
    .filter(ts => ts !== null && ts !== undefined);
  
  if (timestamps.length === 0) {
    return null;
  }
  
  return timestamps.reduce((oldest, ts) => {
    return new Date(ts) < new Date(oldest) ? ts : oldest;
  });
}

/**
 * Calculate time ago from ISO timestamp
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {number} - Time difference in milliseconds
 */
function getTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  return now - date;
}

/**
 * Handle main error with appropriate messaging
 * @param {Error} error - Error object
 */
function handleMainError(error) {
  const errorMsg = error.message.toLowerCase();
  
  if (errorMsg.includes('rate limit') || error.message.includes('429')) {
    console.error('Error: API rate limit exceeded.');
    console.error('Please wait a moment and try again.');
    console.error('The MBTA API limits the number of requests per minute.');
  } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed')) {
    console.error('Error: Network error occurred.');
    console.error('Please check your internet connection and try again.');
  } else if (errorMsg.includes('500') || errorMsg.includes('server error')) {
    console.error('Error: MBTA API server error.');
    console.error('Please try again later.');
  } else {
    console.error(`Error: ${error.message}`);
  }
  
  process.exit(1);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\x1b[0mExiting...\n');
  process.exit(0);
});

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
