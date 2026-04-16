import 'dotenv/config';

const API_KEY = process.env.MBTA_API_KEY || null;
if (!API_KEY) console.warn('Warning: MBTA_API_KEY not set. Running unauthenticated (rate limit: 20 req/min). See .env.example.');
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
  
  const headers = { 'Accept': 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;
  const response = await fetch(url, { headers
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
 * Fetch live predictions for a route/direction.
 * @param {string} routeNumber
 * @param {number} directionId
 * @returns {Promise<Array>} - Array of { vehicleId, stopId, arrivalTime, departureTime, stopSequence }
 */
export async function fetchRoutePredictions(routeNumber, directionId) {
  const params = {
    'filter[route]': routeNumber,
    'filter[direction_id]': directionId.toString(),
  };
  const data = await fetchFromApi('/predictions', params);
  return (data.data || []).flatMap(p => {
    const vehicleId = p.relationships?.vehicle?.data?.id ?? null;
    if (!vehicleId) return [];
    return [{
      vehicleId,
      stopId: p.relationships?.stop?.data?.id ?? null,
      arrivalTime: p.attributes?.arrival_time ?? null,
      departureTime: p.attributes?.departure_time ?? null,
      stopSequence: p.attributes?.stop_sequence ?? null,
    }];
  });
}

/**
 * Fetch routes by MBTA route type filter string (e.g. '3' or '0,1')
 * @param {string} typeFilter
 * @returns {Promise<Array>} - Array of {id, name} objects sorted by id
 */
async function fetchRoutesByType(typeFilter) {
  const data = await fetchFromApi('/routes', { 'filter[type]': typeFilter });
  return (data.data || [])
    .map(r => ({ id: r.id, name: r.attributes?.long_name || r.id }))
    .sort((a, b) => {
      const na = parseFloat(a.id), nb = parseFloat(b.id);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.id.localeCompare(b.id);
    });
}

export async function fetchBusRoutes() {
  return fetchRoutesByType('3');
}

export async function fetchSubwayRoutes() {
  return fetchRoutesByType('0,1'); // light rail (0) + heavy rail (1)
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
 * Fetch a set of stops by ID (used to resolve vehicle child stop IDs)
 * @param {string[]} ids
 * @returns {Promise<Array>} - Array of raw stop data
 */
export async function fetchStopsByIds(ids) {
  if (ids.length === 0) return [];
  const data = await fetchFromApi('/stops', { 'filter[id]': ids.join(',') });
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
    currentStopId: vehicle.relationships?.stop?.data?.id || null,
    lastUpdated: attrs.updated_at || null,
    occupancyStatus: attrs.occupancy_status || null,
    currentStatus: attrs.current_status || 'UNKNOWN',
    speed: attrs.speed,
    revenue: attrs.revenue === 'REVENUE',
    carriages: (attrs.carriages || []).map(c => ({
      label: c.label,
      occupancyStatus: c.occupancy_status,
      occupancyPercentage: c.occupancy_percentage,
    })),
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
    platformName: attrs.platform_name || null,
    latitude: attrs.latitude,
    longitude: attrs.longitude,
    parentStationId: stop.relationships?.parent_station?.data?.id ?? null,
  };
}
