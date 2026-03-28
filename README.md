# MBTA-Visualizer

A CLI tool that fetches real-time bus data for MBTA Route 87 and displays an ASCII visualization of all active buses along their route.

![screenshot](./screenshot.png)

## Overview

MBTA-Visualizer provides a simple, terminal-based view of real-time bus positions for Boston's Route 87. It fetches data from the MBTA V3 API and renders a clean ASCII representation showing:

- Bus locations relative to stops
- Bus identifiers (e.g., `[87]`)
- Stop names along the route
- Direction indicators (outbound/inbound)
- Auto-refresh functionality

## Features

- **Real-time tracking**: Fetches live bus positions from the MBTA API
- **ASCII visualization**: Works in any terminal, no special dependencies
- **Auto-refresh**: Updates every 30 seconds automatically
- **Error handling**: Graceful handling of network issues and API rate limits
- **Stale data warnings**: Alerts you if data hasn't been updated recently
- **No external dependencies**: Uses only Node.js built-in modules

## Requirements

- Node.js 18+ (for built-in `fetch` API support)
- Internet connection (to reach the MBTA API)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mbta-vis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Run the visualizer:

```bash
npm start
# or
node src/main.js
```

### Keyboard Controls

- **Ctrl+C**: Exit the application

### Auto-Refresh

The tool automatically refreshes every 30 seconds. A countdown timer shows when the next refresh will occur.

## How It Works

1. **Fetch Data**: Queries the MBTA V3 API for:
   - Real-time vehicle positions for Route 87
   - All stops along the route

2. **Process Data**:
   - Calculates which segment between stops each bus is in
   - Determines proportional position based on distance traveled

3. **Render Visualization**:
   - Displays stops as labeled points
   - Shows buses as `[87]` markers at appropriate positions
   - Indicates direction (outbound/inbound)

## API

This tool uses the official [MBTA V3 API](https://api-v3.mbta.com/). The API key is included in the source code for convenience, but you can replace it with your own key from the [MBTA Developer Portal](https://www.mbta.com/data/apis).

## Project Structure

```
mbta-vis/
├── src/
│   ├── main.js          # CLI entry point and main logic
│   ├── mbta-api.js      # MBTA API integration
│   ├── visualizer.js    # ASCII rendering logic
│   ├── utils.js         # Utility functions
│   └── *.test.js        # Test files
├── package.json
├── eslint.config.js
└── run.sh
```

## Testing

Run the test suite:

```bash
npm test
```

Lint the code:

```bash
npm run lint
```

## Development

The project uses:

- **ES Modules** (no bundler required)
- **Native `fetch`** for HTTP requests
- **ESLint** for code quality

## Troubleshooting

### "No active buses on Route 87"
This means no buses are currently running. This can happen:
- Late at night or early morning
- On holidays
- During service disruptions

### "API rate limit exceeded"
The MBTA API has rate limits. Wait a moment and try again. The tool will automatically retry.

### "Network error occurred"
Check your internet connection and try again.

### Stale data warning
If you see a warning about stale data, the last known bus positions may be outdated. This can happen if buses have stopped transmitting location data.

## License

MIT

## Acknowledgments

- [MBTA](https://www.mbta.com/) for providing open transit data
- [MBTA V3 API](https://api-v3.mbta.com/) documentation

---

Built with ❤️ for Boston commuters
