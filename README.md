# MBTA Visualizer

A real-time terminal UI for tracking MBTA buses and subway trains, showing live vehicle positions, occupancy, and arrival predictions. Uses `blessed` for that authentic ncurses mouthfeel.

![screenshot](./screenshot.png)

## Requirements

- Node.js 18+
- Internet connection

## Installation

```bash
git clone <repository-url>
cd mbta-vis
npm install
```

No API key is required — the MBTA API is public and works unauthenticated. If you're running multiple tabs or refreshing frequently, you may hit the anonymous rate limit (20 req/min). To get a higher limit, grab a free key from [api.mbta.com](https://api.mbta.com) and add it:

```bash
cp .env.example .env
# edit .env and set MBTA_API_KEY=your_key_here
```

## Usage

```bash
node src/main.js [route] [direction]

# Examples
node src/main.js 87 0    # Route 87, outbound
node src/main.js Green-D 1  # Green Line D, inbound
```

Defaults to route `87`, direction `0` (outbound).

## Interface

The display is split into two panes:

**Left — Stop list**: All stops in route order with live vehicle markers and arrival ETAs. Vehicles are color-coded; the stop they occupy (or departed from) is highlighted in the same color.

**Right — Vehicle cards**: One card per active vehicle, sorted to match the stop list order. Each card shows:
- Status icon (`■` stopped, `▶` moving, `▷` arriving), current/departed stop, revenue indicator, occupancy
- Status label (`stopped` / `moving` / `arriving`) and speed in mph (when available)
- Destination and ETA on the next line (when in transit or arriving)
- Per-car occupancy bars for subway vehicles

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `r` | Open route selector |
| `d` | Toggle inbound / outbound |
| `n` | New tab |
| `← →` / `Tab` / `1–9` | Switch tabs |
| `↑ ↓` / `j k` | Scroll stop list |
| `PgUp / PgDn` | Scroll by 10 stops |
| `?` | Help overlay |
| `q` / Ctrl-C | Quit |

## Project Structure

```
src/
  main.js           — entry point, fetch/refresh loop
  mbta-api.js       — MBTA API v3 calls and response parsers
  utils.js          — bus placement, color palette, markers
  screen.js         — blessed screen, tab bar, status bar, overlays
  views/
    route-view.js   — split-pane route visualization
```

## License

MIT
