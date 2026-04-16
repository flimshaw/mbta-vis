import { THEME, OVERRIDE_THEME, getThemeByName } from './theme.js';

// Use override theme if set, otherwise use detected theme
const activeTheme = OVERRIDE_THEME ? getThemeByName(OVERRIDE_THEME) : THEME;

// Timing
export const AUTO_REFRESH_MS = 3000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;

// Defaults
export const DEFAULT_ROUTE = '87';
export const DEFAULT_DIRECTION = 0;

// Layout
export const RIGHT_WIDTH = 68;

// Direction labels indexed by directionId (0 = Outbound, 1 = Inbound)
export const DIRECTION_LABELS = ['Outbound', 'Inbound'];

// Theme-aware semantic colors — the single set used by all views
export const COLORS = {
  inactive: activeTheme.inactive,
  active: activeTheme.active,
  activeBg: activeTheme.activeBg,
  cyan: activeTheme.cyan,
  green: activeTheme.green,
  yellow: activeTheme.yellow,
  red: activeTheme.red,
  blue: activeTheme.blue,
  barInactive: activeTheme.barInactive,
  barActive: activeTheme.barActive,
  border: activeTheme.border ?? 'cyan',        // fallback for 256-color theme
  borderActive: activeTheme.borderActive ?? activeTheme.cyan,
  statusFg: activeTheme.statusFg,
  statusBg: activeTheme.statusBg,
};

// Occupancy levels in increasing order, used to build fill bars
export const OCCUPANCY_LEVELS = [
  { status: 'EMPTY',                      filled: 0, color: activeTheme.green  },
  { status: 'MANY_SEATS_AVAILABLE',       filled: 1, color: activeTheme.green  },
  { status: 'FEW_SEATS_AVAILABLE',        filled: 2, color: activeTheme.yellow },
  { status: 'STANDING_ROOM_ONLY',         filled: 3, color: activeTheme.yellow },
  { status: 'CRUSHED_STANDING_ROOM_ONLY', filled: 4, color: activeTheme.red    },
  { status: 'FULL',                       filled: 5, color: activeTheme.red    },
  { status: 'NOT_ACCEPTING_PASSENGERS',   filled: 5, color: activeTheme.red    },
  { status: 'NO_DATA_AVAILABLE',          filled: 0, color: activeTheme.barInactive },
];
export const BAR_TOTAL = 5;

// Expose the palette for busColor() hashing (via getVehicleColor in theme.js)
export const BUS_PALETTE = activeTheme.palette;
