import blessed from 'blessed';

let overlay = null;

export function showHelp(screen) {
  if (overlay) {
    overlay.destroy();
    overlay = null;
    screen.render();
    return;
  }

  overlay = blessed.box({
    top: 'center',
    left: 'center',
    width: 44,
    height: 18,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: 'yellow' } },
    content: [
      '',
      '  {bold}Keyboard Shortcuts{/bold}',
      '',
      '  {cyan-fg}n{/cyan-fg}       New tab',
      '  {cyan-fg}r{/cyan-fg}       Open route selector',
      '  {cyan-fg}d{/cyan-fg}       Toggle inbound/outbound',
      '  {cyan-fg}↑↓ / j k{/cyan-fg} Scroll stops list',
      '  {cyan-fg}PgUp/Dn{/cyan-fg} Scroll stops by 10',
      '  {cyan-fg}?{/cyan-fg}       Toggle this help',
      '  {cyan-fg}← →{/cyan-fg}     Switch tabs (or mode in selector)',
      '  {cyan-fg}1-9{/cyan-fg}     Jump to tab',
      '  {cyan-fg}q{/cyan-fg}       Quit',
      '',
      '  {bold}Bus Status Icons{/bold}',
      '',
      '  {yellow-fg}■{/yellow-fg}  STOPPED_AT    {green-fg}▶{/green-fg}  IN_TRANSIT_TO',
      '  {cyan-fg}▷{/cyan-fg}  INCOMING_AT',
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
