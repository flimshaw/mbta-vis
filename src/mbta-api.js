const API_KEY = '4fb48f72dffb426c9b0386b74dce5f44';
const BASE_URL = 'https://api-v3.mbta.com';

/**
 * Fetch data from MBTA API with error handling
 * @param {string} endpoint - API endpoint path (without query params)
 * @param {object} params - Query parameters object
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function fetchFromApi(endpoint, params = {}) {
  const searchParams = new URLSearchParams(params);
  const queryString = searchParams.toString();
  const url = queryString ? `${BASE_URL}${endpoint}?${queryString}` : `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'x-api-key': API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API rate limit exceeded. Please wait before retrying.');
    }
    throw new Error(`API request failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetch all vehicles for a route
 * @param {string} routeNumber - Route number (e.g., '87', '57', '92')
 * @param {number} directionId - 0 for outbound, 1 for inbound
 * @returns {Promise<Array>} - Array of vehicle data
 */
export async function fetchRouteVehicles(routeNumber, directionId = null) {
  const params = { 'filter[route]': routeNumber };
  if (directionId !== null) {
    params['filter[direction_id]'] = directionId.toString();
  }
  
  const data = await fetchFromApi('/vehicles', params);
  return data.data || [];
}

/**
 * Fetch all bus routes
 * @returns {Promise<Array>} - Array of {id, name} objects sorted by id
 */
export async function fetchBusRoutes() {
  const data = await fetchFromApi('/routes', { 'filter[type]': '3' });
  return (data.data || [])
    .map(r => ({ id: r.id, name: r.attributes?.long_name || r.id }))
    .sort((a, b) => {
      const na = parseFloat(a.id), nb = parseFloat(b.id);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Fetch stops for a route in route order, filtered by direction.
 * @param {string} routeNumber - Route number (e.g., '87', '57', '92')
 * @param {number} directionId - 0 or 1
 * @returns {Promise<Array>} - Array of stop data in route order
 */
export async function fetchRouteStops(routeNumber, directionId = 0) {
  const data = await fetchFromApi('/stops', {
    'filter[route]': routeNumber,
    'filter[direction_id]': directionId.toString(),
  });
  return data.data || [];
}

/**
 * Parse vehicle data into normalized format
 * @param {object} vehicle - Raw vehicle data from API
 * @returns {object|null} - Normalized vehicle data or null if invalid
 */
export function parseVehicle(vehicle) {
  if (!vehicle || !vehicle.attributes) {
    return null;
  }

  const attrs = vehicle.attributes;
  
  // Get bus label (route number displayed on bus)
  const label = attrs.label || vehicle.id;
  
  return {
    id: vehicle.id,
    label: label,
    latitude: attrs.latitude,
    longitude: attrs.longitude,
    directionId: attrs.direction_id,
    currentStopSequence: attrs.current_stop_sequence,
    lastUpdated: attrs.last_update,
    occupancyStatus: attrs.occupancy_status || 'UNKNOWN',
    currentStatus: attrs.current_status || 'UNKNOWN'
  };
}

/**
 * Parse stop data into normalized format
 * @param {object} stop - Raw stop data from API
 * @returns {object|null} - Normalized stop data or null if invalid
 */
export function parseStop(stop) {
  if (!stop || !stop.attributes) {
    return null;
  }

  const attrs = stop.attributes;
  
  return {
    id: stop.id,
    name: attrs.name || `Stop ${stop.id}`,
    latitude: attrs.latitude,
    longitude: attrs.longitude,
    stopId: attrs.stop_id
  };
}
