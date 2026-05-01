import blessed from 'blessed';
import { COLORS } from '../config.js';
import { CHARSETS } from '../theme.js';

let overlay = null;

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
    height: 18,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: COLORS.border } },
    content: [
      '',
      '  {bold}Keyboard Shortcuts{/bold}',
      '',
      `  {${COLORS.cyan}-fg}n{/${COLORS.cyan}-fg}       New tab`,
      `  {${COLORS.cyan}-fg}r{/${COLORS.cyan}-fg}       Open route selector`,
      `  {${COLORS.cyan}-fg}d{/${COLORS.cyan}-fg}       Toggle inbound/outbound`,
      `  {${COLORS.cyan}-fg}${cs.arrow}${cs.arrow} / j k{/${COLORS.cyan}-fg} Scroll stops list`,
      `  {${COLORS.cyan}-fg}PgUp/Dn{/${COLORS.cyan}-fg} Scroll stops by 10`,
      `  {${COLORS.cyan}-fg}?{/${COLORS.cyan}-fg}       Toggle this help`,
      `  {${COLORS.cyan}-fg}<< >>{/${COLORS.cyan}-fg}     Switch tabs (or mode in selector)`,
      `  {${COLORS.cyan}-fg}1-9{/${COLORS.cyan}-fg}     Jump to tab`,
      `  {${COLORS.cyan}-fg}q{/${COLORS.cyan}-fg}       Quit`,
      '',
      '  {bold}Bus Status Icons{/bold}',
      '',
      `  {${COLORS.yellow}-fg}${cs.stopped}{/${COLORS.yellow}-fg}  STOPPED_AT    {${COLORS.green}-fg}${cs.inTransit}{/${COLORS.green}-fg}  IN_TRANSIT_TO`,
      `  {${COLORS.cyan}-fg}${cs.incoming}{/${COLORS.cyan}-fg}  INCOMING_AT`,
      '',
      `  {dim}              Version 1.0.6              {/dim}`, 
    ].join('\n'),
  });

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
