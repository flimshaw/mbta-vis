/**
 * Pure domain-logic helpers for route data.
 * No imports required — all transforms operate on plain data objects.
 */

/**
 * Group raw predictions by vehicleId, with each group sorted by stopSequence.
 * @param {Array} rawPredictions
 * @returns {Object} Map of vehicleId → sorted prediction array
 */
export function groupPredictions(rawPredictions) {
  const predictions = {};
  for (const p of rawPredictions) {
    (predictions[p.vehicleId] ??= []).push(p);
  }
  for (const arr of Object.values(predictions)) {
    arr.sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
  }
  return predictions;
}

/**
 * Collect stop IDs referenced by buses or predictions that are not already
 * present in the list of route stops.
 * @param {Array} buses          - parsed vehicle objects (each has .currentStopId)
 * @param {Array} rawPredictions - raw prediction objects (each has .stopId)
 * @param {Array} routeStops     - parsed stop objects (each has .id)
 * @returns {string[]} deduplicated list of unknown stop IDs
 */
export function resolveUnknownStopIds(buses, rawPredictions, routeStops) {
  const routeStopIds = new Set(routeStops.map(s => s.id));
  return [...new Set(
    [...buses.map(b => b.currentStopId), ...rawPredictions.map(p => p.stopId)]
      .filter(id => id && !routeStopIds.has(id))
  )];
}

/**
 * Stable cache key for a route+direction pair.
 * @param {string|number} route
 * @param {number} direction
 * @returns {string}
 */
export function cacheKey(route, direction) {
  return `${route}:${direction}`;
}
