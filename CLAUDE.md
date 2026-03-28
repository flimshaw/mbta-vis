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
- `q` / Ctrl-C — quit

## Project structure

```
src/
  main.js           — entry point; fetch/refresh loop, wires screen + views
  mbta-api.js       — all MBTA API v3 calls and response parsers
  utils.js          — pure functions: haversine math, bus placement, markers
  screen.js         — blessed screen singleton; tab bar, status bar, overlays
  views/
    route-view.js   — bus route visualization view (the main view)
```

### Architectural pattern: views

Every view follows the same interface:

```js
// createFooView() → { box: BlessedBox, update(...data) }
export function createFooView() {
  const box = blessed.box({ top: 1, left: 0, width: '100%', height: '100%-2', tags: true });
  function update(/* domain data */) { /* rebuild box children, screen.render() */ }
  return { box, update };
}
```

`screen.js` owns the tab bar, status bar, and overlays. It knows nothing about what's inside a view. Views know nothing about tabs or the status bar — they only call `getScreen()` to get the screen reference for rendering.

To add a new view (e.g. subway, bus detail):
1. Create `src/views/my-view.js` exporting `createMyView()`
2. In `main.js`: `const v = createMyView(); addTab('Label', v);`
3. Wire any data fetching into `refreshAndDisplay()` or a separate refresh loop

### Data flow

```
main.js
  └─ fetchRouteVehicles()  ─┐
  └─ getStops() (cached)   ─┤─ Promise.all → buses + stops + extraStops
  └─ fetchStopsByIds()      ─┘
       │
       ▼
  view.update(buses, stops, extraStops, directionId, routeNumber)
       │
       ├─ placeBuses(buses, stops)      ← utils.js, returns [{ bus, segmentIndex, proportion, stopIdx }]
       ├─ renderColumn(...)             ← builds blessed tag strings, one line per stop
       └─ updateInfoBox(...)            ← per-bus overlay cards
```

**Stop caching:** `getStops()` in `main.js` caches parsed stops by `"route:direction"` key. Stops only re-fetch when the route or direction changes. Vehicles are re-fetched every `AUTO_REFRESH_MS` (10s).

**Child stop IDs:** MBTA vehicles report child stop IDs (specific berths/platforms) that differ from the parent stop IDs returned by `/stops?filter[route]=...`. After parsing vehicles, `main.js` batch-fetches any unknown stop IDs via `fetchStopsByIds()` and passes them to the view as `extraStops`. Route placement always uses parent stops; the overlay uses the exact vehicle stop for display.

## Key files in detail

### `src/mbta-api.js`
- `fetchFromApi(endpoint, params)` — base fetch with auth header and error handling
- `fetchRouteVehicles(route, directionId)` — returns raw vehicle array
- `fetchRouteStops(route, directionId)` — returns stops in route order
- `fetchStopsByIds(ids[])` — batch-fetch stops by ID list (for vehicle child stops)
- `fetchBusRoutes()` — all bus routes (type=3), sorted numerically
- `parseVehicle(raw)` — normalizes to `{ id, label, latitude, longitude, currentStatus, currentStopId, currentStopSequence, occupancyStatus, speed, revenue, lastUpdated }`
- `parseStop(raw)` — normalizes to `{ id, name, platformName, latitude, longitude }`

### `src/utils.js`
- `calculateDistance(lat1, lon1, lat2, lon2)` — haversine, returns meters
- `calculatePositionProportion(busLat, busLon, stop1..., stop2...)` — 0–1 along segment
- `findBusSegment(bus, stops)` — returns `{ segmentIndex, proportion, stop1, stop2 }` for the closest segment
- `placeBuses(buses, stops)` — maps all buses to `{ bus, segmentIndex, proportion, stopIdx }`, filters unplaceable
- `busMarker(bus)` — returns `{ char }` based on `currentStatus`
- `busColor(busId, colorMap)` — assigns stable color from palette; pass the same `Map` across renders
- `formatOccupancy(status)` — human-readable string

### `src/screen.js`
- `initScreen()` — creates blessed screen, tab bar, status bar, registers keys
- `addTab(label, view)` — appends view box to screen, returns tab index
- `updateTabLabel(index, label)` — updates tab bar text
- `setActiveTab(index)` — shows/hides view boxes
- `setStatus(text)` — updates status bar (supports blessed tags)
- `setRouteList(routes)` — populates route picker overlay
- `onRouteSelect(cb)` / `onDirectionToggle(cb)` — register callbacks
- `getScreen()` — returns the blessed screen instance (used by views)

### `src/views/route-view.js`
- `createRouteView()` — returns `{ box, update(buses, stops, extraStops, directionId, routeNumber) }`
- Internally: `contentBox` (cleared each render) + `infoBox` (persistent overlay, appended after contentBox so it renders on top)
- `renderColumn(stops, segmentBuses, innerWidth, hasMoreStops, colorMap)` — one blessed-tagged string per stop: `marker stopName ╎····▶·····`
- `updateInfoBox(buses, stops, extraStops, unplaced, colorMap, infoBox)` — 2-line cards per bus with occupancy bar
- `occupancyBar(status)` — `[█████]` fill bar, green/yellow/red
- `padBetween(left, right, totalWidth)` — right-aligns text accounting for blessed tags (strips `{tag}` before measuring)

## Blessed rendering notes

- Screen uses `smartCSR: true` for differential rendering (no full redraws)
- The view `box` is created with `top: 1, height: '100%-2'` to sit between tab bar (row 0) and status bar (last row)
- `infoBox` must be appended **after** `contentBox` — blessed renders children in append order, so earlier children are hidden behind later ones
- Destroy/recreate children via `box.children.slice().forEach(c => c.destroy())` — do this on `contentBox`, never on the outer `box` which holds the persistent `infoBox`
- Blessed tag format: `{color-fg}text{/color-fg}`, `{bold}text{/bold}` — strip with `/\{\/?\w[\w-]*\}/g` when measuring visible width
- Key handlers on overlays fire **in addition to** screen-level handlers — always null-check before calling `.destroy()` in overlay close handlers

## MBTA API notes

- Base URL: `https://api-v3.mbta.com`
- Auth: `x-api-key` header (not Bearer token)
- Vehicle `current_status`: `STOPPED_AT` | `IN_TRANSIT_TO` | `INCOMING_AT`
- Vehicle `occupancy_status`: `EMPTY` | `MANY_SEATS_AVAILABLE` | `FEW_SEATS_AVAILABLE` | `STANDING_ROOM_ONLY` | `CRUSHED_STANDING_ROOM_ONLY` | `FULL` | `NOT_ACCEPTING_PASSENGERS`
- Vehicle `revenue`: `"REVENUE"` or `"NON_REVENUE"` (deadheading)
- `/stop_times` endpoint returns 404 with this API key — do not use it
- `/stops?filter[route]&filter[direction_id]` returns stops in route order
- Vehicle `relationships.stop` often points to a child stop (berth/platform) whose ID won't be in the route stop list — handle with `fetchStopsByIds()`
