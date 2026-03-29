# MBTA Visualizer — Claude Guidelines

## Running the app

```bash
node src/main.js [route] [direction]
# e.g. node src/main.js 77 0   (route 77, outbound)
# e.g. node src/main.js 87 1   (route 87, inbound)
```

Defaults: route `87`, direction `0` (outbound).

**Keyboard shortcuts in the TUI:**
- `r` — open route selector overlay
- `d` — toggle inbound/outbound
- `?` — help overlay
- `← →` or `1-9` — switch tabs
- `n` — new tab
- `q` / Ctrl-C — quit

## Project structure

```
src/
  main.js               — entry point: arg parse, init screen, wire callbacks (~40 lines)
  config.js             — all constants: timing, palette, occupancy levels, direction labels
  mbta-api.js           — all MBTA API v3 calls and response parsers
  utils.js              — pure functions: haversine math, bus placement, markers, colors
  screen.js             — blessed screen singleton: tab bar, status bar, key routing
  tab-manager.js        — tab state, timer lifecycle, refresh/retry loop
  domain/
    route-data.js       — prediction grouping, unknown stop ID resolution, cache key
    stop-lookup.js      — unified stop lookup factory (route stops + extra stops)
  views/
    route-view.js       — view layout shell: two-pane setup, scroll state
    vehicle-card.js     — vehicle card rendering, status lines, ETA, occupancy bars
    stop-column.js      — stop list / track visualization renderer
  overlays/
    route-selector.js   — route picker overlay
    help.js             — help overlay
```

### Architecture: layered modules

Data flows down through distinct layers. Each layer has one job:

```
config.js           ← constants (timing, palette, occupancy, layout)
    ↓
mbta-api.js         ← HTTP + response parsing
    ↓
domain/             ← pure transforms: group predictions, resolve stop IDs
    ↓
tab-manager.js      ← owns tab state, timers, refresh loop; calls API + domain
    ↓
views/              ← factory functions { box, update, scroll }; render only
    ↓
screen.js           ← blessed singleton: tab bar, status bar, key routing
    ↑
overlays/           ← self-contained overlay modules; accept screen as parameter
```

### Architectural pattern: views

Every view follows the same interface:

```js
// createFooView() → { box: BlessedBox, update(...data), scroll(delta) }
export function createFooView() {
  const box = blessed.box({ top: 1, left: 0, width: '100%', height: '100%-2', tags: true });
  function update(/* domain data */) { /* render to box children, screen.render() */ }
  function scroll(delta) { /* adjust offset, re-call update */ }
  return { box, update, scroll };
}
```

`screen.js` owns the tab bar and key routing. Views know nothing about tabs or the status bar — they only call `getScreen()` for rendering. `tab-manager.js` owns the data refresh lifecycle and calls `view.update()`.

**To add a new view (e.g. a detail panel):**
1. Create `src/views/my-view.js` exporting `createMyView()`
2. In `main.js`: pass `createMyView` as the `createView` dep to `createTabManager()`
   — or add a separate tab via `addTab('Label', createMyView())` after `initScreen()`
3. Data fetching belongs in `tab-manager.js` (or a new parallel refresh loop if the view needs different data)

### Data flow

```
tab-manager.js
  └─ fetchRouteVehicles()      ─┐
  └─ getStops() (cached)       ─┤─ Promise.all → raw data
  └─ fetchRoutePredictions()    ─┘
       │
       ├─ resolveUnknownStopIds()  ← domain/route-data.js
       ├─ fetchStopsByIds()        ← mbta-api.js (for child stops)
       └─ groupPredictions()       ← domain/route-data.js
            │
            ▼
  view.update(buses, stops, extraStops, directionId, routeNumber, predictions)
       │
       ├─ placeBuses(buses, stops)         ← utils.js
       ├─ createStopLookup(stops, extras)  ← domain/stop-lookup.js
       ├─ renderColumn(...)                ← views/stop-column.js
       └─ renderVehicleCard(...)           ← views/vehicle-card.js
```

**Stop caching:** `tab-manager.js` caches parsed stops per tab by `"route:direction"` key (via `cacheKey()` from domain/route-data.js). Stops only re-fetch when the route or direction changes. Vehicles and predictions re-fetch every `AUTO_REFRESH_MS` (10s, set in config.js).

**Child stop IDs:** MBTA vehicles report child stop IDs (specific berths/platforms) that differ from the parent stop IDs returned by `/stops?filter[route]=...`. After parsing vehicles, `tab-manager.js` batch-fetches unknown IDs via `fetchStopsByIds()` and passes them as `extraStops`. `createStopLookup(stops, extraStops)` provides a single `(id) => stop` function used throughout the view layer.

## Key files in detail

### `src/config.js`
Single source of truth for all constants:
- `AUTO_REFRESH_MS`, `MAX_RETRIES`, `RETRY_DELAY_MS` — timing
- `DEFAULT_ROUTE`, `DEFAULT_DIRECTION` — startup defaults
- `RIGHT_WIDTH` — vehicle pane width in columns
- `DIRECTION_LABELS` — `['Outbound', 'Inbound']` indexed by directionId
- `BUS_PALETTE` — 12 hex colors for per-vehicle identity coloring
- `OCCUPANCY_LEVELS`, `BAR_TOTAL` — occupancy fill bar definitions

### `src/mbta-api.js`
- `fetchFromApi(endpoint, params)` — base fetch with auth header and error handling
- `fetchRouteVehicles(route, directionId)` — returns raw vehicle array
- `fetchRoutePredictions(route, directionId)` — returns `[{ vehicleId, stopId, arrivalTime, departureTime, stopSequence }]`
- `fetchRouteStops(route, directionId)` — returns stops in route order
- `fetchStopsByIds(ids[])` — batch-fetch stops by ID list (for vehicle child stops)
- `fetchBusRoutes()` / `fetchSubwayRoutes()` — all routes by type, sorted numerically
- `parseVehicle(raw)` — normalizes to `{ id, label, latitude, longitude, currentStatus, currentStopId, currentStopSequence, occupancyStatus, speed, revenue, lastUpdated, carriages }`
- `parseStop(raw)` — normalizes to `{ id, name, platformName, latitude, longitude }`

### `src/tab-manager.js`
- `createTabManager(deps)` — factory; deps: `{ createView, addTab, updateTabLabel, setStatus, setActiveTab, openRouteSelector }`
- Returns: `{ create, handleRouteSelect, requestNewTab, toggleDirection, switchTab, scrollActive }`
- Owns all per-tab state: route, direction, timers, cached stops, last status text
- `cancelTimers(tab)` is private — no other module clears tab timers

### `src/domain/route-data.js`
Pure functions, no imports:
- `groupPredictions(rawPredictions)` — `{ [vehicleId]: Prediction[] }` sorted by stopSequence
- `resolveUnknownStopIds(buses, rawPredictions, routeStops)` — deduped IDs not in route stop list
- `cacheKey(route, direction)` — `"${route}:${direction}"`

### `src/domain/stop-lookup.js`
- `createStopLookup(routeStops, extraStops)` — returns `(id) => stop | undefined`; route stops take priority over extra stops

### `src/utils.js`
- `calculateDistance(lat1, lon1, lat2, lon2)` — haversine, returns meters
- `calculatePositionProportion(busLat, busLon, stop1..., stop2...)` — 0–1 along segment
- `findBusSegment(bus, stops)` — returns `{ segmentIndex, proportion, stop1, stop2 }` for the closest segment
- `placeBuses(buses, stops)` — maps all buses to `{ bus, segmentIndex, proportion, stopIdx }`, filters unplaceable
- `busMarker(bus)` — returns `{ char }` based on `currentStatus`
- `busColor(busId, colorMap)` — assigns stable color from `BUS_PALETTE`; pass the same `Map` across renders
- `formatOccupancy(status)` — human-readable string

### `src/screen.js`
- `initScreen()` — creates blessed screen, tab bar, status bar, registers all key bindings
- `addTab(label, view)` — appends view box to screen, returns tab index
- `updateTabLabel(index, label)` — updates tab bar text
- `setActiveTab(index)` — shows/hides view boxes
- `setStatus(text)` — updates status bar (supports blessed tags)
- `setRouteList(modes)` — populates route picker data (consumed by overlay on open)
- `onRouteSelect(cb)` / `onDirectionToggle(cb)` / `onNewTab(cb)` / `onTabSwitch(cb)` / `onScroll(cb)` — register callbacks
- `openRouteSelector()` — programmatically open the route overlay
- `getScreen()` — returns the blessed screen instance (used by views)

### `src/views/route-view.js`
- `createRouteView()` — returns `{ box, update(buses, stops, extraStops, directionId, routeNumber, predictions), scroll(delta) }`
- Manages scroll state and two-pane layout (left: stop list, right: vehicle cards)
- Delegates rendering to `renderColumn()` (stop-column.js) and `renderVehicleCard()` (vehicle-card.js)
- Re-renders on terminal resize via `screen.on('resize', ...)`

### `src/views/vehicle-card.js`
- `renderVehicleCard(bus, placement, colorMap, stops, lookup, vehiclePreds, INNER)` — unified card for bus and subway/rail; adds carriage bar when `bus.carriages.length > 0`
- `statusLines(bus, placement, stops, lookup, vehiclePreds, INNER)` — 1–2 line status block
- `fmtEta(isoTime)` — relative ETA string (`"now"`, `"3m"`, or null if past)
- `etaForStop(vehiclePreds, stopName, lookup)` — find ETA for a named stop from predictions
- `occupancyBar(status)` — `[█████]` fill bar, green/yellow/red
- `miniCarBar(carriage)` — per-carriage occupancy bar for subway
- `padBetween(left, right, totalWidth)` — right-aligns text; strips `{tag}` before measuring

### `src/views/stop-column.js`
- `renderColumn(stops, segmentBuses, innerWidth, hasMoreStops, colorMap, globalOffset, stopEtas)` — one blessed-tagged string per stop: `marker stopName ╎····▶·····`

### `src/overlays/route-selector.js`
- `showRouteSelector(screen, cachedModes, onSelect)` — toggles route picker overlay; supports multiple mode tabs (Bus, Subway, etc.) with left/right switching

### `src/overlays/help.js`
- `showHelp(screen)` — toggles help overlay

## Blessed rendering notes

- Screen uses `smartCSR: true` for differential rendering (no full redraws)
- The view `box` is created with `top: 1, height: '100%-2'` to sit between tab bar (row 0) and status bar (last row)
- Blessed tag format: `{color-fg}text{/color-fg}`, `{bold}text{/bold}` — strip with `/\{[^}]+\}/g` when measuring visible width
- Key handlers on overlays fire **in addition to** screen-level handlers — always null-check before calling `.destroy()` in overlay close handlers
- Mouse wheel events on panes (`wheelup`/`wheeldown`) are bound directly on the pane boxes

## MBTA API notes

- Base URL: `https://api-v3.mbta.com`
- Auth: `x-api-key` header (not Bearer token)
- Vehicle `current_status`: `STOPPED_AT` | `IN_TRANSIT_TO` | `INCOMING_AT`
- Vehicle `occupancy_status`: `EMPTY` | `MANY_SEATS_AVAILABLE` | `FEW_SEATS_AVAILABLE` | `STANDING_ROOM_ONLY` | `CRUSHED_STANDING_ROOM_ONLY` | `FULL` | `NOT_ACCEPTING_PASSENGERS`
- Vehicle `revenue`: `"REVENUE"` or `"NON_REVENUE"` (deadheading)
- `/stop_times` endpoint returns 404 with this API key — do not use it
- `/stops?filter[route]&filter[direction_id]` returns stops in route order
- Vehicle `relationships.stop` often points to a child stop (berth/platform) whose ID won't be in the route stop list — handle with `fetchStopsByIds()`
- Route types: `0`=Light rail, `1`=Subway, `2`=Commuter rail, `3`=Bus, `4`=Ferry
