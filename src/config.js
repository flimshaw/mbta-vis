// Timing
export const AUTO_REFRESH_MS = 10000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;

// Defaults
export const DEFAULT_ROUTE = '87';
export const DEFAULT_DIRECTION = 0;

// Layout
export const RIGHT_WIDTH = 68;

// Direction labels indexed by directionId (0 = Outbound, 1 = Inbound)
export const DIRECTION_LABELS = ['Outbound', 'Inbound'];

// Color palette for per-vehicle identity coloring.
// Avoid red (reserved for errors) and grey (inactive stops).
export const BUS_PALETTE = [
  '#4dabf7', // sky blue
  '#69db7c', // green
  '#ffd43b', // yellow
  '#da77f2', // violet
  '#ff922b', // orange
  '#38d9a9', // teal
  '#f783ac', // pink
  '#a9e34b', // lime
  '#74c0fc', // light blue
  '#e599f7', // lavender
  '#63e6be', // mint
  '#ffa8a8', // salmon
];

// Occupancy levels in increasing order, used to build fill bars
export const OCCUPANCY_LEVELS = [
  { status: 'EMPTY',                      filled: 0, color: 'green'  },
  { status: 'MANY_SEATS_AVAILABLE',       filled: 1, color: 'green'  },
  { status: 'FEW_SEATS_AVAILABLE',        filled: 2, color: 'yellow' },
  { status: 'STANDING_ROOM_ONLY',         filled: 3, color: 'yellow' },
  { status: 'CRUSHED_STANDING_ROOM_ONLY', filled: 4, color: 'red'    },
  { status: 'FULL',                       filled: 5, color: 'red'    },
  { status: 'NOT_ACCEPTING_PASSENGERS',   filled: 5, color: 'red'    },
  { status: 'NO_DATA_AVAILABLE',          filled: 0, color: 'grey'   },
];
export const BAR_TOTAL = 5;
