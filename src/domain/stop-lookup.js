/**
 * Create a unified stop lookup function over both route stops and extra stops.
 * Extra stops are vehicle-reported child stops (berths/platforms) not in the main route list.
 *
 * @param {Array} routeStops - Stops in route order
 * @param {Array} extraStops - Additional stops fetched for vehicle/prediction child stop IDs
 * @returns {function(string): object|undefined} - Lookup function: (id) => stop | undefined
 */
export function createStopLookup(routeStops, extraStops) {
  const byId = new Map();
  extraStops.forEach(s => byId.set(s.id, s));
  routeStops.forEach(s => byId.set(s.id, s)); // route stops win

  const routeStopIds = new Set(routeStops.map(s => s.id));

  // Walk parent_station chain until we land on a route stop (or give up).
  function resolveToRouteStop(id) {
    let cur = byId.get(id);
    let hops = 0;
    while (cur && !routeStopIds.has(cur.id) && hops < 3) {
      if (!cur.parentStationId) return null;
      cur = byId.get(cur.parentStationId);
      hops++;
    }
    return cur && routeStopIds.has(cur.id) ? cur : null;
  }

  const lookup = id => byId.get(id);
  lookup.resolveToRouteStop = resolveToRouteStop;
  return lookup;
}
