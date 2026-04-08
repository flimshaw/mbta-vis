# Debug Logging Plan

## Goal
Add a `--debug` flag that outputs a timeline of all status updates for routes in a structured format (CSV or JSON), capturing all data used by the tool for display purposes.

---

## Implementation Plan

### 1. Add `--debug` Flag Parsing

**File to modify:** `src/main.js`

**Changes:**
- Parse command-line argument for `--debug`
- Set global `DEBUG_MODE` constant
- Pass flag to `createTabManager` and `createRouteView`

**Example usage:**
```bash
node src/main.js 77 0 --debug
node src/main.js 87 1 --debug
```

---

### 2. Define Debug Output Format

**Format choice:** **JSON Lines** (one JSON object per line)

**Reasoning:**
- Easier to parse than raw CSV for nested structures (placements, predictions, carriages)
- Human-readable while being machine-parseable
- Can be processed with `jq` or simple line-by-line parsing
- Each line is independent — no need to wait for file completion

**Structure per refresh cycle:**
```json
{
  "timestamp": "2026-04-08T12:34:56.789Z",
  "event": "refresh",
  "route": "87",
  "direction": 0,
  "directionLabel": "Outbound",
  "vehiclesFetched": 12,
  "stopsFetched": 45,
  "predictionsFetched": 38,
  "vehicles": [
    {
      "id": "701",
      "label": "701",
      "currentStatus": "STOPPED_AT",
      "currentStopId": "place-ale",
      "latitude": 42.3601,
      "longitude": -71.0589,
      "speed": 0,
      "revenue": true,
      "occupancyStatus": "FEW_SEATS_AVAILABLE",
      "carriages": []
    }
  ],
  "stops": [
    {
      "id": "place-ale",
      "name": "Alewife Station",
      "latitude": 42.3601,
      "longitude": -71.0589
    }
  ],
  "placements": [
    {
      "vehicleId": "701",
      "segmentIndex": 5,
      "stopIdx": 5,
      "proportion": 0
    }
  ],
  "predictionsByVehicle": {
    "701": [
      {
        "vehicleId": "701",
        "stopId": "place-ale",
        "stopName": "Alewife Station",
        "arrivalTime": "2026-04-08T12:35:00Z",
        "departureTime": "2026-04-08T12:35:00Z",
        "stopSequence": 5,
        "eta": "now"
      }
    ]
  },
  "extraStops": []
}
```

---

### 3. Modify Core Modules to Support Debug Output

#### A. `tab-manager.js`
- Add `debug` option to `createTabManager`
- Wrap `refreshAndDisplay` with debug wrapper
- Log before and after `view.update()`

**Debug points in `refreshAndDisplay`:**
- Start of fetch cycle
- Raw vehicle/prediction counts
- Unknown stop IDs resolved
- Extra stops fetched
- Final placed vehicles count
- Before calling `view.update()`

#### B. `route-view.js`
- Add `debug` option to `createRouteView`
- Capture final state after all transforms
- Output JSON Lines to file or stdout

**Debug points in `update()`:**
- After `placeBuses()` — show all placements
- After `createStopLookup()` — show extra stops
- Before rendering — show final state passed to views

#### C. `domain/route-data.js`
- Add debug wrapper for `groupPredictions()` — log vehicle IDs with predictions
- Add debug wrapper for `resolveUnknownStopIds()` — log resolved IDs

---

### 4. Implementation Details

#### Global State (`src/debug.js`)
```js
let debugMode = false;
let debugFile = null;

export function setDebugMode(enabled) {
  debugMode = enabled;
  if (enabled) {
    // Initialize debug file or use stdout
  }
}

export function logDebug(event, data) {
  if (!debugMode) return;
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data
  };
  // Write JSON line
}
```

#### Log Events to Capture
| Event | Description |
|-------|-------------|
| `refresh_start` | Tab manager begins fetching data |
| `api_vehicles` | Raw vehicles from API |
| `api_stops` | Raw stops from API |
| `api_predictions` | Raw predictions from API |
| `unknown_stops_resolved` | Child stop IDs found and fetched |
| `extra_stops_fetched` | Child stop details |
| `vehicles_placed` | Placement results with GPS vs stop-ID methods |
| `predictions_grouped` | Prediction counts per vehicle |
| `view_update` | Final state passed to view layer |
| `refresh_complete` | Tab manager finishes refresh |

---

### 5. File Output vs STDOUT

**Option A: Separate log file**
```
--debug[=logfile]   → debug-2026-04-08T12-34-56.log
```

**Option B: STDOUT with `--debug`**
- Easier for piping to `jq`
- Good for real-time monitoring

**Recommendation:** Default to STDOUT, allow optional file path

---

### 6. Usage Examples

**Real-time monitoring:**
```bash
node src/main.js 87 0 --debug | jq -c 'select(.event == "view_update")' | head -5
```

**File output:**
```bash
node src/main.js 87 0 --debug > debug.log
```

**Post-analysis:**
```bash
# Find all vehicles that were stopped at a specific station
jq -r 'select(.event == "view_update" and .vehicles[].currentStatus == "STOPPED_AT") | .vehicles[] | "\(.id) at \(.currentStopId)"' debug.log

# Count vehicles by status over time
jq -r 'select(.event == "refresh") | .vehicles | group_by(.currentStatus) | map({status: .[0].currentStatus, count: length})' debug.log
```

---

### 7. Performance Considerations

- Only serialize and write debug output when `--debug` is enabled
- Use streaming write (line-by-line) instead of buffering
- Keep log entries concise — avoid redundant nested objects
- Consider adding a `--debug-throttle` option to reduce output frequency

---

### 8. Testing Checklist

- [ ] `node src/main.js` (no debug) — no debug output
- [ ] `node src/main.js 87 0 --debug` — debug output to stdout
- [ ] `node src/main.js 87 0 --debug=logfile.log` — debug output to file
- [ ] Verify JSON lines are valid and parseable
- [ ] Verify color mapping persists (check `busColor` calls)
- [ ] Verify placement logic (GPS vs stop-ID fallback)
- [ ] Verify prediction grouping and ETA calculations

---

### 9. Future Enhancements

- Add `--debug-full` for verbose output (include raw API responses)
- Add `--debug-filter=vehicle_id` to only log specific vehicles
- Add `--debug-snapshot` to output single JSON object (not lines)
- Add `--debug-stats` to output summary statistics per refresh
