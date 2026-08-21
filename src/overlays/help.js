import blessed from 'blessed';
import { COLORS, VERSION } from '../config.js';
import { CHARSETS } from '../theme.js';

let overlay = null;

const KEY_START = 2;
const DESC_START = 13;

function addRow(box, line, key, desc, keyColor = COLORS.cyan) {
  blessed.text({
    parent: box,
    left: KEY_START,
    top: line,
    tags: true,
    content: `{${keyColor}-fg}${key}{/${keyColor}-fg}`,
  });
  blessed.text({
    parent: box,
    left: DESC_START,
    top: line,
    tags: true,
    content: desc,
  });
}

export function showHelp(screen) {
  if (overlay) {
    overlay.destroy();
    overlay = null;
    screen.render();
    return;
  }

  const cs = COLORS.asciiMode ? CHARSETS.ascii : CHARSETS.unicode;

  overlay = blessed.box({
    top: 'center',
    left: 'center',
    width: 44,
    height: 20,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: COLORS.border } },
  });

  let line = 1;
  blessed.text({ parent: overlay, left: 0, top: line, tags: true, content: '{bold}Keyboard Shortcuts{/bold}' });
  line += 2;

  addRow(overlay, line++, 'n', 'New tab');
  addRow(overlay, line++, 'r', 'Open route selector');
  addRow(overlay, line++, 'd', 'Toggle inbound/outbound');
  addRow(overlay, line++, `${cs.arrow}${cs.arrow} / j k`, 'Scroll stops list');
  addRow(overlay, line++, 'PgUp/Dn', 'Scroll stops by 10');
  addRow(overlay, line++, '?', 'Toggle this help');
  addRow(overlay, line++, '<< >>', 'Switch tabs or mode');
  addRow(overlay, line++, '1-9', 'Jump to tab');
  addRow(overlay, line++, 'q', 'Quit');

  line += 2;
  blessed.text({ parent: overlay, left: 0, top: line, tags: true, content: '{bold}Bus Status Icons{/bold}' });
  line += 2;
  blessed.text({ parent: overlay, left: 0, top: line, tags: true, content: `{${COLORS.yellow}-fg}${cs.stopped}{/${COLORS.yellow}-fg}  STOPPED_AT    {${COLORS.green}-fg}${cs.inTransit}{/${COLORS.green}-fg}  IN_TRANSIT_TO` });
  line += 1;
  blessed.text({ parent: overlay, left: 0, top: line, tags: true, content: `{${COLORS.cyan}-fg}${cs.incoming}{/${COLORS.cyan}-fg}  INCOMING_AT` });
  line += 2;
  blessed.text({ parent: overlay, left: 0, top: line, tags: true, content: `{dim}  Version ${VERSION}{/dim}` });

  const close = () => {
    if (!overlay) return;
    overlay.destroy();
    overlay = null;
    screen.render();
  };

  overlay.key(['escape', '?'], close);

  screen.append(overlay);
  overlay.focus();
  screen.render();
}
