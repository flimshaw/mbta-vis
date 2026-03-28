# MBTA Visualizer

A real-time terminal UI for tracking MBTA buses and subway trains, showing live vehicle positions, occupancy, and arrival predictions. Uses `blessed` for that authentic ncurses mouthfeel.

## Requirements

- Node.js 18+
- Internet connection

## Installation

```bash
git clone <repository-url>
cd mbta-vis
npm install
```

3. Get a free API key from [api.mbta.com](https://api.mbta.com) (sign up, then create a key under your account)

4. Copy the example env file and add your key:
   ```bash
   cp .env.example .env
   # edit .env and replace 'your_api_key_here' with your actual key
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
