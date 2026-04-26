# Low-Color Terminal Support — Implementation Plan

## Problem

On low-color terminals (Raspberry Pi native console, Cool Retro Terminal, SSH sessions, old terminals), the MBTA Visualizer becomes hard or impossible to read because:

1. **Color detection is unreliable** — Cool Retro Terminal reports `TERM=xterm-256color` but only supports 16 colors. Raspberry Pi console may report `TERM=linux` but actual color support varies.
2. **Unicode characters break or render as garbage** — `◉`, `·`, `╎`, `▶`, `▷`, `■`, `█`, `▁`–`▇`, `─`, `│`, `…` are not supported on VT100-era terminals or retro fonts.
3. **Color-only information encoding** — Occupancy bars, vehicle status, revenue status, and bus identity all rely on color. Without it, information is lost.
4. **No user control** — Only `MBTA_THEME` env var exists, no CLI flag.

## Current Architecture

```
theme.js          ← 3 tiers (256color / basic / monochrome), TERM-env detection only
    ↓
config.js         ← resolves COLORS from active theme at import time
    ↓
views/            ← all views import COLORS from config.js
```

**Key issue:** `config.js` resolves colors at **import time** (module load). This means the theme is locked in before the user can override it via CLI. We need to defer resolution.

---

## Phase 1: Quick Wins (make it readable now)

### 1.1 — CLI flag + deferred theme resolution

**Files:** `src/main.js`, `src/config.js`, `src/theme.js`

- Add `--theme` CLI flag: `--theme 256color|basic|monochrome|ascii`
- Refactor `config.js` so `COLORS` is not resolved at import time. Instead:
  - Export a `resolveTheme(name)` function from `theme.js`
  - Call it in `main.js` **after** arg parsing, before `initScreen()`
  - Export `COLORS` as a lazy getter or set it once at startup
- Priority: `--theme` flag > `MBTA_THEME` env var > runtime detection

```js
// main.js (pseudo)
import { parseArgs } from './cli-args.js';
import { resolveTheme } from './theme.js';

const args = parseArgs(process.argv.slice(2));
const themeName = args.theme || process.env.MBTA_THEME || null;
const theme = resolveTheme(themeName);  // auto-detect if null
setActiveTheme(theme);  // makes COLORS available
```

### 1.2 — Runtime color probe

**File:** `src/theme.js`

Add a runtime probe that actually tests terminal color support:

```js
// Write a known color escape to a temp fd and check if terminal supports it
// Use the standard technique: check COLORTERM for "truecolor"/"24bit"
// If TERM says 256color but no COLORTERM, probe with a simple write test
// Fallback: if probe can't run (non-tty), trust TERM env
```

Probe logic (in order):
1. `COLORTERM=truecolor` or `COLORTERM=24bit` → **256color** (with hex palette)
2. `COLORTERM` is set but not truecolor → **256color** (conservative)
3. `TERM` contains `256color` → **basic** (safer — many terminals lie about 256)
4. `TERM` is `xterm`, `screen`, `linux`, `vt220` → **basic**
5. `TERM` is `dumb`, `vt100`, or empty → **ascii** (new tier)
6. **If none match:** write a color escape sequence to stdout and check if it's a tty. If yes → **basic**. If not → **ascii**.

**Key change:** Default for ambiguous cases goes from `256color` to `basic`. This fixes the Cool Retro Terminal problem where `TERM=xterm-256color` but only 16 colors are actually supported.

### 1.3 — New "ascii" theme tier

**File:** `src/theme.js`

Add a 4th theme tier: `ascii`. This is monochrome + pure ASCII characters.

```js
'ascii': {
  name: 'ascii',
  // All colors mapped to 'white' — structure preserved, no color differentiation
  inactive: 'white',
  active: 'white',
  activeBg: 'black',
  cyan: 'white', green: 'white', yellow: 'white',
  red: 'white', blue: 'white', magenta: 'white',
  white: 'white', brightWhite: 'white',
  palette: Array(12).fill('white'),
  barInactive: 'white', barActive: 'white',
  statusFg: 'white', statusBg: 'black',
  // ASCII mode flags
  asciiMode: true,     // replace all Unicode chars with ASCII
  noColors: true,      // strip all blessed color tags
}
```

### 1.4 — Character fallback system

**File:** `src/theme.js` (new export) + all view files

Define a character mapping table keyed by mode:

```js
export const CHARSETS = {
  unicode: {
    stopMarker: '◉',
    trackDot: '·',
    trackEdge: '╎',
    divider: '─',
    separator: '│',
    ellipsis: '…',
    // Status markers
    stopped: '■',
    inTransit: '▶',
    incoming: '▷',
    // Occupancy fill chars
    fill: '█',
    empty: '·',
    // Quarter-block for mini-car (VT220+)
    quarterBlocks: ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  },
  ascii: {
    stopMarker: 'o',
    trackDot: '-',
    trackEdge: '|',
    divider: '-',
    separator: '|',
    ellipsis: '..',
    stopped: '#',
    inTransit: '>',
    incoming: '+',
    // Pure ASCII occupancy: use hash/dot
    fill: '#',
    empty: '.',
    // ASCII mini-car: quantize to 5 levels using mixed chars
    quarterBlocks: ['.', '.', '.', 'o', 'o', 'O', 'O', '#', '#'],
  },
};
```

**Occupancy bar quantization for ASCII mode:**
- 5 levels of fill using `█` → `#` and `·` → `.`
- Pattern: `[#####]` (full), `[##...]` (empty), etc.
- Same visual structure, pure ASCII characters

**Mini-car indicator quantization:**
- 9 quarter-block levels → mapped to 5 ASCII levels:
  - 0 (empty): `.`
  - 1-2 (very low): `.`
  - 3-4 (low-mid): `o`
  - 5-6 (mid-high): `O`
  - 7-8 (high-full): `#`

### 1.5 — Text labels alongside color-only indicators

**Files:** `src/views/vehicle-card.js`, `src/views/stop-column.js`

When theme is `basic`, `monochrome`, or `ascii`, add text labels where color currently carries meaning:

| Current (color-only) | Low-color fallback |
|---|---|
| `{green-fg}✓{/green-fg}` (revenue) | `✓active` or `✓` (always visible) |
| `{red-fg}✗{/red-fg}` (deadhead) | `✗deadhd` |
| Occupancy bar `{color-fg}[████·]{/color-fg}` | `[████·] Full` (text label after bar) |
| Bus color identity (12 colors) | Bus ID number always shown |

**Implementation:** In `vehicle-card.js`, check a `COLORS.asciiMode` or `COLORS.lowColor` flag and conditionally append text.

```js
// vehicle-card.js
const revenue = bus.revenue
  ? (COLORS.asciiMode ? '✓active' : `{${COLORS.green}-fg}✓{/${COLORS.green}-fg}`)
  : (COLORS.asciiMode ? '✗deadhd' : `{${COLORS.red}-fg}✗{/${COLORS.red}-fg}`);
```

### 1.6 — Strip color tags in ascii mode

**File:** `src/theme.js` or a new `src/views/format.js`

When `asciiMode` is true, all blessed color tags should be stripped before rendering. Option A: make `COLORS` values empty strings so tags become `{--fg}`. Option B: add a `tag(color, text)` helper that returns plain text in ascii mode.

```js
export function tag(color, text) {
  if (COLORS.asciiMode) return text;
  return `{${color}-fg}${text}{/${color}-fg}`;
}
```

This is cleaner than conditionals everywhere. All view files use `tag()` instead of inline `{color-fg}` strings.

---

## Phase 2: Polish & Architecture

### 2.1 — Refactor: tag() helper everywhere

**Files:** All view files, overlays

Replace all inline `{color-fg}text{/color-fg}` with `tag(color, text)` calls. This centralizes the ascii-mode stripping logic.

**Migration strategy:**
1. Create `src/views/format.js` with `tag()`, `bold()`, `bg()` helpers
2. Migrate `vehicle-card.js` first (most complex)
3. Migrate `stop-column.js`
4. Migrate `route-view.js`
5. Migrate overlays

### 2.2 — Character helper

**File:** `src/views/format.js`

```js
import { CHARSETS } from '../theme.js';

export function char(name) {
  const charset = COLORS.asciiMode ? CHARSETS.ascii : CHARSETS.unicode;
  return charset[name] || name;
}

// Usage: char('stopped') → '■' or '#'
//        char('trackDot') → '·' or '-'
//        char('fill') → '█' or '#'
```

### 2.3 — Improved runtime color detection

**File:** `src/theme.js`

Add a more sophisticated probe:

```js
// Try writing a 256-color escape and checking if the terminal echoes it
// If stdout is a pty, write \x1b[38;5;255m test \x1b[0m
// If the terminal strips it, we know it doesn't support 256 colors
// This is a best-effort probe — not foolproof but better than TERM alone
```

Also add detection for known problematic terminals:
- `cool-retro-term` → force `basic` (check via checking if process.title or window title contains "retro")
- Raspberry Pi `console` → force `basic` (TERM=linux with no COLORTERM)

### 2.4 — Occupancy bar text labels

**File:** `src/views/vehicle-card.js`

In low-color modes, append a short text label after the occupancy bar:

```js
export function occupancyBar(status) {
  const level = OCCUPANCY_LEVELS.find(l => l.status === status);
  if (!level) return tag(COLORS.inactive, '[.....]');

  const filled = char('fill').repeat(level.filled) + char('empty').repeat(BAR_TOTAL - level.filled);
  const bar = `[${filled}]`;

  if (COLORS.asciiMode || COLORS.lowColor) {
    const label = formatOccupancy(status).slice(0, 6); // "Empty", "Full", "Crushed"
    return tag(level.color, bar) + ` ${label}`;
  }
  return tag(level.color, bar);
}
```

### 2.5 — Vehicle identity without color

**File:** `src/views/vehicle-card.js`

In low-color modes, always show the vehicle number/ID prominently. Currently, the vehicle card shows the stop name colored by vehicle. In ascii mode, ensure the vehicle number is always visible:

```
#8723 at Downtown Crossing  ✓active  moving  25mph
```

### 2.6 — Status bar contrast

**File:** `src/screen.js`

The status bar uses `COLORS.statusBg` (blue) as background. On some terminals, white-on-blue is hard to read. In low-color modes:
- Use inverse video (reverse) for status bar if available
- Or use black bg with white fg

### 2.7 — Documentation

**File:** `README.md`

Add a "Terminal Compatibility" section:

```markdown
## Terminal Compatibility

The MBTA Visualizer adapts to your terminal's capabilities. For best results:

- **Modern terminals** (iTerm2, Terminal.app, GNOME Terminal): Full 256-color mode with hex colors
- **Basic terminals** (xterm, Linux console): 16-color mode with standard ANSI colors
- **ASCII mode** (VT100, retro terminals): Pure ASCII characters, no color

Force a theme:
```bash
mbta-vis --theme basic    # Force 16-color mode
mbta-vis --theme ascii    # Pure ASCII, no color
MBTA_THEME=basic mbta-vis # Via environment variable
```
```

---

## File Change Summary

### Phase 1 files:
| File | Changes |
|---|---|
| `src/theme.js` | Add `ascii` tier, `CHARSETS` table, runtime probe, `resolveTheme()` |
| `src/config.js` | Defer `COLORS` resolution, add `asciiMode` flag |
| `src/main.js` | Add `--theme` CLI flag, call `resolveTheme()` after arg parse |
| `src/views/vehicle-card.js` | Text labels for revenue/occupancy in low-color, char fallbacks |
| `src/views/stop-column.js` | Char fallbacks for markers, track, dots |
| `src/views/route-view.js` | Char fallbacks for pane labels |
| `src/screen.js` | Status bar contrast fix for low-color |
| `src/overlays/route-selector.js` | Char fallbacks |
| `src/overlays/help.js` | Char fallbacks |

### Phase 2 files:
| File | Changes |
|---|---|
| `src/views/format.js` | **NEW** — `tag()`, `bold()`, `char()` helpers |
| All view files | Migrate to `tag()` helper |
| `src/theme.js` | Improved runtime probe, known-terminal detection |
| `README.md` | Terminal compatibility docs |

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `tag()` refactor breaks rendering | Keep inline tags as fallback during migration; test each file |
| Runtime probe gives wrong result | Always allow `--theme` override; log detected theme |
| ASCII mode too verbose | Quantize carefully; test on actual retro terminal |
| Blessed doesn't support all color names | Use only standard 16 colors in `basic`/`ascii` modes |

## Testing Strategy

1. **Local:** `MBTA_THEME=ascii node src/main.js` — verify no color tags, ASCII chars
2. **Local:** `MBTA_THEME=basic node src/main.js` — verify 16-color rendering
3. **Remote:** SSH to Raspberry Pi, run with default detection
4. **Retro:** Test in Cool Retro Terminal (if available)
5. **CI:** Add a test that verifies `CHARSETS.ascii` contains no Unicode above 0x7F
