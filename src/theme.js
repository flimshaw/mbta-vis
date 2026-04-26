/**
 * Theme system for terminal color compatibility.
 * Detects terminal capabilities and provides appropriate color schemes.
 */

// Character sets for different terminal modes
export const CHARSETS = {
  unicode: {
    stopMarker: '◉',
    trackDot: '·',
    trackEdge: '╎',
    divider: '─',
    separator: '│',
    ellipsis: '…',
    stopped: '■',
    inTransit: '▶',
    incoming: '▷',
    fill: '█',
    empty: '·',
    quarterBlocks: ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
    check: '✓',
    cross: '✗',
    arrow: '→',
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
    fill: '#',
    empty: '.',
    quarterBlocks: ['.', '.', '.', 'o', 'o', 'O', 'O', '#', '#'],
    check: 'v',
    cross: 'x',
    arrow: '->',
  },
};

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
    palette: [
      '#4dabf7', '#69db7c', '#ffd43b', '#da77f2', '#ff922b',
      '#38d9a9', '#f783ac', '#a9e34b', '#74c0fc', '#e599f7',
      '#63e6be', '#ffa8a8'
    ],
    barInactive: 'grey',
    barActive: 'green',
    statusFg: 'white',
    statusBg: 'blue',
    border: 'cyan',
    borderActive: 'cyan',
    asciiMode: false,
    lowColor: false,
  },

  // Basic 16-color theme (legacy terminals)
  'basic': {
    name: 'basic-16',
    inactive: 'white',
    active: 'white',
    activeBg: 'black',
    cyan: 'cyan',
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    blue: 'blue',
    magenta: 'magenta',
    white: 'white',
    brightWhite: 'white',
    palette: [
      'cyan', 'green', 'yellow', 'magenta', 'cyan',
      'green', 'magenta', 'yellow', 'blue', 'red',
      'blue', 'red'
    ],
    barInactive: 'white',
    barActive: 'green',
    statusFg: 'white',
    statusBg: 'blue',
    border: 'white',
    borderActive: 'white',
    asciiMode: false,
    lowColor: true,
  },

  // Monochrome theme (very limited terminals)
  'monochrome': {
    name: 'monochrome',
    inactive: 'white',
    active: 'white',
    activeBg: 'black',
    cyan: 'white',
    green: 'white',
    yellow: 'white',
    red: 'white',
    blue: 'white',
    magenta: 'white',
    white: 'white',
    brightWhite: 'white',
    palette: Array(12).fill('white'),
    barInactive: 'white',
    barActive: 'white',
    statusFg: 'white',
    statusBg: 'black',
    border: 'white',
    borderActive: 'white',
    asciiMode: false,
    lowColor: true,
  },

  // ASCII mode — pure ASCII, no color, no Unicode
  'ascii': {
    name: 'ascii',
    inactive: 'white',
    active: 'white',
    activeBg: 'black',
    cyan: 'white',
    green: 'white',
    yellow: 'white',
    red: 'white',
    blue: 'white',
    magenta: 'white',
    white: 'white',
    brightWhite: 'white',
    palette: Array(12).fill('white'),
    barInactive: 'white',
    barActive: 'white',
    statusFg: 'white',
    statusBg: 'black',
    border: 'white',
    borderActive: 'white',
    asciiMode: true,
    lowColor: true,
  },
};

/**
 * Detect terminal capabilities and return appropriate theme name.
 * @returns {string} Theme name
 */
export function detectThemeName() {
  const term = process.env.TERM || '';
  const colorterm = process.env.COLORTERM || '';

  // Known problematic terminals that lie about 256-color support
  if (process.title && (
      process.title.includes('cool-retro-term') ||
      process.title.includes('cool retro')
    )) {
    return 'basic';
  }

  if (colorterm === 'truecolor' || colorterm === '24bit') {
    return '256color';
  }

  if (term.includes('256')) {
    if (colorterm || term === 'xterm-256color' || term === 'screen-256color') {
      return '256color';
    }
    return 'basic';
  }

  if (term === 'xterm' || term === 'screen' || term === 'vt220') {
    return 'basic';
  }

  if (term === 'linux') {
    return 'basic';
  }

  if (term === 'dumb' || term === 'vt100' || term === 'cons25') {
    return 'ascii';
  }

  return 'basic';
}

/**
 * Get a theme by name.
 * @param {string} name - Theme name
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

// Determine current theme: CLI override > env var > auto-detect
const cliOverride = process.argv.slice(2).find(a => a === '--theme');
const themeName = cliOverride
  ? (process.argv[process.argv.indexOf('--theme') + 1] || null)
  : process.env.MBTA_THEME || null;

const currentTheme = themeName ? getThemeByName(themeName) : getThemeByName(detectThemeName());

export const THEME = currentTheme;
export const THEME_NAME = currentTheme.name;
export const OVERRIDE_THEME = themeName;

// Log theme detection for debugging
if (process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.MBTA_THEME || cliOverride) {
  console.error(`[Theme] Detected: ${THEME_NAME}`);
  console.error(`[Theme] TERM=${process.env.TERM || 'not set'}`);
  console.error(`[Theme] COLORTERM=${process.env.COLORTERM || 'not set'}`);
  if (process.env.MBTA_THEME) console.error(`[Theme] Override: ${process.env.MBTA_THEME}`);
  if (cliOverride) console.error(`[Theme] CLI: --theme ${process.argv[process.argv.indexOf('--theme') + 1]}`);
}
