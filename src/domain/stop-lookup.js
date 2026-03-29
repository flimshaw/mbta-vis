/**
 * Create a unified stop lookup function over both route stops and extra stops.
 * Extra stops are vehicle-reported child stops (berths/platforms) not in the main route list.
 *
 * @param {Array} routeStops - Stops in route order
 * @param {Array} extraStops - Additional stops fetched for vehicle/prediction child stop IDs
 * @returns {function(string): object|undefined} - Lookup function: (id) => stop | undefined
 */
export function createStopLookup(routeStops, extraStops) {
  const byId = Object.fromEntries(routeStops.map(s => [s.id, s]));
  const extraById = Object.fromEntries(extraStops.map(s => [s.id, s]));
  return (id) => byId[id] ?? extraById[id];
}
