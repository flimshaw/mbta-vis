/**
 * Theme system for terminal color compatibility.
 * Detects terminal capabilities and provides appropriate color schemes.
 */

// Theme definitions
const themes = {
  // Full 256-color theme (modern terminals)
  '256color': {
    name: '256-color',
    inactive: 'grey',
    active: 'white',
    activeBg: 'black',
    cyan: 'cyan',
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    blue: 'blue',
    magenta: 'magenta',
    white: 'white',
    brightWhite: 'brightWhite',
    // Custom hex colors for vehicles
    palette: [
      '#4dabf7', '#69db7c', '#ffd43b', '#da77f2', '#ff922b',
      '#38d9a9', '#f783ac', '#a9e34b', '#74c0fc', '#e599f7',
      '#63e6be', '#ffa8a8'
    ],
    // Blessed color names that work in 256-color terminals
    barInactive: 'grey',
    barActive: 'green',
    statusFg: 'white',
    statusBg: 'blue',
  },

  // Basic 16-color theme (legacy terminals, some SSH sessions)
  // Uses only standard 16 ANSI colors that work in all terminals
  'basic': {
    name: 'basic-16',
    inactive: 'white',      // Use white instead of grey (grey not supported)
    active: 'white',        // Active tab text (white for visibility)
    activeBg: 'black',      // Active tab background
    cyan: 'cyan',
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    blue: 'blue',
    magenta: 'magenta',
    white: 'white',
    brightWhite: 'white',   // Fall back to white if brightWhite not supported
    // Use only standard 16 colors (no bright* variants for maximum compatibility)
    palette: [
      'cyan', 'green', 'yellow', 'magenta', 'cyan',
      'green', 'magenta', 'yellow', 'blue', 'red',
      'blue', 'red'
    ],
    barInactive: 'white',
    barActive: 'green',
    statusFg: 'white',
    statusBg: 'blue',
    border: 'white',        // Border color for visibility
    borderActive: 'white',  // Border color for active elements
  },

  // Monochrome theme (very limited terminals)
  'monochrome': {
    name: 'monochrome',
    inactive: 'white',
    active: 'brightWhite',
    activeBg: 'black',
    cyan: 'white',
    green: 'white',
    yellow: 'white',
    red: 'white',
    blue: 'white',
    magenta: 'white',
    white: 'white',
    brightWhite: 'brightWhite',
    palette: Array(12).fill('white'),
    barInactive: 'white',
    barActive: 'white',
    statusFg: 'white',
    statusBg: 'black',
  },
};

/**
 * Detect terminal capabilities and return appropriate theme.
 * @returns {object} Theme object
 */
export function detectTheme() {
  const term = process.env.TERM || '';
  const colorterm = process.env.COLORTERM || '';

  // Check for explicit 256-color support
  if (term.includes('256') || colorterm.includes('256')) {
    return themes['256color'];
  }

  // Check for truecolor support
  if (colorterm === 'truecolor' || colorterm === '24bit') {
    return themes['256color'];
  }

  // Check for xterm-256color specifically
  if (term === 'xterm-256color' || term === 'screen-256color') {
    return themes['256color'];
  }

  // Check for basic xterm or screen
  if (term === 'xterm' || term === 'screen' || term === 'vt220') {
    return themes['basic'];
  }

  // Check for linux console (Raspberry Pi native terminal)
  if (term === 'linux') {
    // Linux console supports 16 colors but not grey
    return themes['basic'];
  }

  // Check for dumb terminals
  if (term === 'dumb' || term === 'vt100') {
    return themes['monochrome'];
  }

  // Default: try 256-color first, fall back to basic
  // Most modern systems support at least 16 colors
  return themes['256color'];
}

/**
 * Get a theme by name.
 * @param {string} name - Theme name ('256color', 'basic', 'monochrome')
 * @returns {object} Theme object
 */
export function getThemeByName(name) {
  return themes[name] || themes['256color'];
}

/**
 * List available themes.
 * @returns {string[]} Array of theme names
 */
export function getAvailableThemes() {
  return Object.keys(themes);
}

/**
 * Format a color string for blessed, using theme-aware colors.
 * @param {string} colorName - Color name from theme
 * @param {string} suffix - Optional suffix like '-fg' or '-bg'
 * @returns {string} Blessed color string
 */
export function formatColor(colorName, suffix = '-fg') {
  return `{${colorName}${suffix}}`;
}

// Export current theme on module load
const currentTheme = detectTheme();

export const THEME = currentTheme;
export const THEME_NAME = currentTheme.name;

// Allow manual theme override via environment variable
export const OVERRIDE_THEME = process.env.MBTA_THEME || null;

// Log theme detection for debugging
if (process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.MBTA_THEME) {
  console.error(`[Theme] Detected: ${THEME_NAME}`);
  console.error(`[Theme] TERM=${process.env.TERM || 'not set'}`);
  console.error(`[Theme] COLORTERM=${process.env.COLORTERM || 'not set'}`);
  if (process.env.MBTA_THEME) {
    console.error(`[Theme] Override: ${process.env.MBTA_THEME}`);
  }
}
