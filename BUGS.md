# Known Issues and Bugs

## Critical Issues

- [ ] ### 1. Race Condition: `getRouteName` Called Before Route Data Loads
**File**: `main.js`, `screen.js`

The `getRouteName` callback is passed to `createTabManager` immediately, but route data (`cachedModes`) is fetched asynchronously via `Promise.all([fetchBusRoutes(), fetchSubwayRoutes()])`. This means:
- When `tm.create(initialRoute, initialDirection)` is called, `getRouteName()` returns `null` because `cachedModes` is still empty
- The initial tab always shows "Route X" format instead of proper line names (e.g., "Red Line")

**Impact**: Initial tab labels are incorrect until routes are fetched (which may never happen if the user doesn't interact).

**Fix**: Either:
- Wait for route data to load before creating the initial tab
- Fetch routes upfront synchronously before `initScreen()`
- Use a fallback that updates the tab label when data arrives

---

- [ ] ### 2. Race Condition: `newTabPending` Flag
**File**: `tab-manager.js`

The `newTabPending` flag is a simple boolean set in `requestNewTab()` and checked in `handleRouteSelect()`. If a user presses `n`, then `r`, then `r` again before selecting a route:
- First `n`: sets `newTabPending = true`, opens selector
- First `r`: closes selector (no selection), `newTabPending` stays `true`
- Second `r`: closes selector again (no selection), `newTabPending` stays `true`
- Next route selection: creates a new tab unexpectedly

**Impact**: May create unexpected tabs or fail to create tabs as expected.

**Fix**: Use a more robust state machine or clear the flag immediately after opening the selector (not after selection).

---

## Memory and Lifecycle Issues

- [ ] ### 3. Memory Leak: Timer Cleanup on Tab Destruction
**File**: `tab-manager.js`

- Tabs can be created but there's no mechanism to close/destroy tabs
- When `switchRoute()` or `toggleDirection()` is called, `cancelTimers(tab)` clears the timers for the active tab
- However, if you switch routes multiple times, old tab states remain in memory with no cleanup path
- No tab close functionality exists (e.g., `q` on a specific tab, or Ctrl-W)

**Impact**: Memory leak with many tab switches; no way to reduce tab count.

**Fix**: Implement proper tab destruction with timer cancellation and array splicing. Add tab close keybinding.

---

## UI/UX Issues

- [ ] ### 4. Incomplete Scroll Boundary Handling
**File**: `route-view.js`

```javascript
scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, stops.length - pageSize)));
```

- Redundant `Math.max(0, ...)` calls (inner one is unnecessary)
- When stops are fetched and the list changes, the scroll offset might not clamp correctly if the new list is shorter
- No visual feedback when reaching scroll boundaries

**Impact**: Scroll position may be incorrect after data refresh; user may not know they're at the boundary.

**Fix**: Simplify the clamping logic and ensure it handles shrinking lists.

- [ ] ### 5. Hardcoded Magic Numbers
**Files**: `route-view.js`, `vehicle-card.js`, `stop-column.js`

Several places use hardcoded values that should be constants:
- `INNER = rightPane.width - 2` - the `-2` for border is scattered
- `pageSize = contentHeight - 4` - the `-4` assumes specific header/border layout
- `LABEL_WIDTH = Math.floor(innerWidth / 2) - 2` - the `-2` is implicit padding

**Impact**: Difficult to maintain and adjust layout.

**Fix**: Extract to `config.js` with descriptive names.

- [ ] ### 6. Tab Bar Click Handler Off-by-One Risk
**File**: `screen.js`

```javascript
const tabWidth = tabs[i].label.length + 2; // " label "
// ...
pos += tabWidth + 1; // +1 for │ separator
```

The click detection assumes all labels fit without truncation. If a label is updated to be longer (e.g., route name changes), the click detection may misalign.

**Impact**: Tab clicking may not work correctly for long route names.

**Fix**: Calculate actual rendered widths or use blessed's built-in mouse handling.

---

## Error Handling Issues

- [ ] ### 7. Missing Error Boundaries
**File**: `tab-manager.js`, `mbta-api.js`

If the MBTA API returns malformed data:
- `parseVehicle` and `parseStop` return `null`, which gets filtered out (handled)
- But if an entire batch fails (e.g., `fetchStopsByIds` for unknown stop IDs), the error is caught in `refreshAndDisplay`, yet `extraStops` becomes empty
- This can cause lookup failures downstream in the view layer

**Impact**: Partial data failures can cause cascading UI issues.

**Fix**: Add better error boundaries and fallbacks for partial data failures.

- [ ] ### 8. No Input Validation
**File**: `main.js`

If a user runs `node src/main.js invalid_route 5`:
- The app tries to fetch data for that route
- Errors are handled, but there's no validation that the route ID exists
- Direction values other than 0 or 1 are accepted (may cause API errors or unexpected behavior)

**Impact**: Poor user experience with cryptic errors.

**Fix**: Add validation for route existence and direction values (0 or 1).

- [ ] ### 9. API Key Warning Always Shown
**File**: `mbta-api.js`

```javascript
const API_KEY = process.env.MBTA_API_KEY || null;
if (!API_KEY) console.warn('Warning: MBTA_API_KEY not set...');
```

The warning is shown on every startup, even if the user has no intention of running multiple tabs or hitting rate limits. For local development, this is noise.

**Impact**: Annoying warning for casual users.

**Fix**: Only show warning if DEBUG is set, or suppress with an environment variable.

---

## Code Quality Issues

- [ ] ### 10. Blessed Tag Stripping Inconsistency
**File**: `vehicle-card.js`

The `padBetween` function strips tags using `/\{[^}]+\}/g`, but:
- This regex doesn't handle nested or malformed tags
- If any blessed tag contains a `}` character in its content (unlikely but possible), the width calculation will be wrong

**Impact**: Potential layout glitches with malformed tags.

**Fix**: Use a more robust tag-stripping function or validate tag format.

- [ ] ### 11. Test Coverage Gaps
**Files**: `tab-manager.js`, `route-view.js`, `domain/route-data.js`

Current tests cover:
- `mbta-api.test.js` ✓
- `utils.test.js` ✓

Missing tests for:
- `tab-manager.js` (core business logic)
- `route-view.js` (rendering logic)
- `domain/route-data.js` (pure functions that are critical)
- `domain/stop-lookup.js`
- `views/vehicle-card.js`
- `views/stop-column.js`

**Impact**: Hard to make changes confidently; bugs may go undetected.

**Fix**: Add unit tests for domain logic and integration tests for tab management.

- [ ] ### 12. Unused Exports
**File**: `screen.js`

- `getActiveTabIndex()` is exported but never called anywhere in the codebase
- `openRouteSelector()` duplicates functionality already available via the overlay module

**Impact**: Dead code; confusion about which function to use.

**Fix**: Remove unused exports or add documentation for intended use.

- [ ] ### 13. Redundant Status Bar Text
**File**: `screen.js`, `tab-manager.js`

The status bar always includes the help text `[r] route [n] new tab [?] help [q] quit`, but this is also shown in the help overlay. The text takes up significant space and could be shortened or made conditional.

**Impact**: Wasted screen real estate.

**Fix**: Shorten to `[r]routes [n]new [?]help [q]quit` or make configurable.

---

## Edge Cases

- [ ] ### 14. Route Selector with Empty Routes
**File**: `overlays/route-selector.js`

If `cachedModes` is empty (routes failed to fetch), the selector shows "Loading routes..." but:
- There's no way to refresh the route list
- Pressing `enter` on "Loading routes..." does nothing (correct, but no feedback)
- User may be stuck if they opened the selector before routes loaded

**Impact**: User may be confused if routes don't load.

**Fix**: Add a refresh option or timeout retry for route fetching.

- [ ] ### 15. Terminal Resize with Overlay Open
**File**: `overlays/route-selector.js`, `overlays/help.js`

If the terminal is resized while an overlay is open:
- The overlay dimensions don't recalculate
- The overlay may extend beyond the visible screen

**Impact**: Overlay may become unusable.

**Fix**: Listen for resize events and recalculate overlay dimensions.

- [ ] ### 16. Unplaced Vehicles Not Shown in Info Box
**File**: `views/route-view.js`

The `updateInfoBox` function renders vehicle cards for placed buses, but unplaced vehicles (those that couldn't be mapped to a segment) are only mentioned in the console/developer sense - they're not shown in the right pane at all.

**Impact**: Users may wonder where certain vehicles went.

**Fix**: Show unplaced vehicles in a separate section of the info box.

---

## Removed (Fixed)

- [x] ### ~~ESLint Config Missing~~ (FIXED)
The `eslint.config.js` file now exists with proper configuration for ES modules.

- [x] ### ~~Memory Leak: Timer Cleanup on Tab Switching~~ (PARTIALLY FIXED)
Timers are now properly cancelled when switching routes or toggling direction. However, there's still no tab destruction mechanism (see Issue #3).

---

## Recommendations

1. **Fix the async initialization issue** - Most critical bug (Issue #1)
2. **Add tab close functionality** with proper timer cleanup (Issue #3)
3. **Add input validation** for route/direction arguments (Issue #8)
4. **Add more comprehensive tests** for domain logic and tab management (Issue #11)
5. **Extract magic numbers to config.js** for consistency (Issue #5)
6. **Add loading state** while initial route data fetches (Issue #1)
7. **Add integration tests** that simulate user interactions (Issue #11)
8. **Handle terminal resize** for overlays (Issue #15)
9. **Add unplaced vehicle display** in info box (Issue #16)
10. **Fix newTabPending flag logic** (Issue #2)
