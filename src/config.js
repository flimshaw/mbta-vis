import { THEME } from './theme.js';

// Timing
export const AUTO_REFRESH_MS = 10000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;

// Defaults
export const DEFAULT_ROUTE = '87';
export const DEFAULT_DIRECTION = 0;

// Direction labels indexed by directionId (0 = Outbound, 1 = Inbound)
export const DIRECTION_LABELS = ['Outbound', 'Inbound'];

// Theme-aware semantic colors — the single set used by all views
export const COLORS = {
  inactive: THEME.inactive,
  active: THEME.active,
  activeBg: THEME.activeBg,
  cyan: THEME.cyan,
  green: THEME.green,
  yellow: THEME.yellow,
  red: THEME.red,
  blue: THEME.blue,
  barInactive: THEME.barInactive,
  barActive: THEME.barActive,
  border: THEME.border || 'cyan',
  borderActive: THEME.borderActive || THEME.cyan,
  statusFg: THEME.statusFg,
  statusBg: THEME.statusBg,
  asciiMode: THEME.asciiMode || false,
  lowColor: THEME.lowColor || false,
};

// Occupancy levels in increasing order, used to build fill bars
export const OCCUPANCY_LEVELS = [
  { status: 'EMPTY',                      filled: 0, color: THEME.green  },
  { status: 'MANY_SEATS_AVAILABLE',       filled: 1, color: THEME.green  },
  { status: 'FEW_SEATS_AVAILABLE',        filled: 2, color: THEME.yellow },
  { status: 'STANDING_ROOM_ONLY',         filled: 3, color: THEME.yellow },
  { status: 'CRUSHED_STANDING_ROOM_ONLY', filled: 4, color: THEME.red    },
  { status: 'FULL',                       filled: 5, color: THEME.red    },
  { status: 'NOT_ACCEPTING_PASSENGERS',   filled: 5, color: THEME.red    },
  { status: 'NO_DATA_AVAILABLE',          filled: 0, color: THEME.barInactive },
];
export const BAR_TOTAL = 5;

// Palette for busColor() hashing
export const BUS_PALETTE = THEME.palette;
