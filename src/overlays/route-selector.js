import blessed from 'blessed';
import { COLORS } from '../config.js';

let overlay = null;

export function showRouteSelector(screen, cachedModes, onSelect) {
  if (overlay) {
    overlay.destroy();
    overlay = null;
    screen.render();
    return;
  }

  const modes = cachedModes.length > 0
    ? cachedModes
    : [{ label: 'Routes', routes: [{ id: '…', name: 'Loading routes…' }] }];

  let activeModeIdx = 0;
  const currentRoutes = () => modes[activeModeIdx].routes;
  const fmtItem = r => `  ${r.id.padEnd(6)} ${r.name}`;

  const maxHeight = Math.floor(screen.height * 0.8);
  overlay = blessed.list({
    top: 'center',
    left: 'center',
    width: 50,
    height: maxHeight,
    border: { type: 'line' },
    label: buildModeLabel(modes, activeModeIdx),
    tags: true,
    mouse: true,
    style: { selected: { bg: COLORS.statusBg, fg: COLORS.statusFg }, border: { fg: COLORS.border } },
    items: currentRoutes().map(fmtItem),
  });

  const close = () => {
    if (!overlay) return;
    overlay.destroy();
    overlay = null;
    screen.render();
  };

  const switchMode = (delta) => {
    activeModeIdx = (activeModeIdx + delta + modes.length) % modes.length;
    overlay.setLabel(buildModeLabel(modes, activeModeIdx));
    overlay.setItems(currentRoutes().map(fmtItem));
    overlay.select(0);
    screen.render();
  };

  overlay.key(['escape', 'r'], close);
  overlay.key('left', () => switchMode(-1));
  overlay.key('right', () => switchMode(1));

  const overlayPageSize = Math.max(1, maxHeight - 2);
  overlay.key('pageup', () => {
    const i = overlay.selected;
    overlay.select(Math.max(0, i - overlayPageSize));
    screen.render();
  });
  overlay.key('pagedown', () => {
    const i = overlay.selected;
    overlay.select(Math.min(currentRoutes().length - 1, i + overlayPageSize));
    screen.render();
  });
  overlay.key(['up', 'k'], () => {
    const routes = currentRoutes();
    const i = overlay.selected;
    overlay.select(i <= 0 ? routes.length - 1 : i - 1);
    screen.render();
  });
  overlay.key(['down', 'j'], () => {
    const routes = currentRoutes();
    const i = overlay.selected;
    overlay.select(i >= routes.length - 1 ? 0 : i + 1);
    screen.render();
  });
  overlay.key(['enter', 'return'], () => {
    const route = currentRoutes()[overlay.selected];
    if (!route || route.id === '…') return;
    close();
    if (onSelect) onSelect(route.id);
  });

  screen.append(overlay);
  overlay.focus();
  screen.render();
}

function buildModeLabel(modes, activeModeIdx) {
  const parts = modes.map((m, i) =>
    i === activeModeIdx
      ? `{${COLORS.activeBg}-bg}{${COLORS.active}-fg} ${m.label} {/${COLORS.active}-fg}{/${COLORS.activeBg}-bg}`
      : `{${COLORS.inactive}-fg} ${m.label} {/${COLORS.inactive}-fg}`
  );
  return ` ${parts.join('')} `;
}
