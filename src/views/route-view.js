import blessed from 'blessed';
import { getScreen } from '../screen.js';
import { placeBuses, busColor } from '../utils.js';
import { DIRECTION_LABELS, COLORS } from '../config.js';
import { createStopLookup } from '../domain/stop-lookup.js';
import { renderColumn } from './stop-column.js';
import { occupancyBar, fmtEta, etaForStop, statusLines, vehicleStatusLabel, miniCarBar, renderVehicleCard, padBetween } from './vehicle-card.js';

/**
 * Create a route visualization view.
 * @returns {{ box: BlessedBox, update: function, scroll: function }}
 */
export function createRouteView() {
  // Box dimensions are set by addTab; use percentage fallbacks
  const box = blessed.box({
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-2',
    tags: true,
  });

  // Persistent color assignments so bus colors stay stable across refreshes
  const colorMap = new Map();

  // Scroll state — persists across data refreshes
  let scrollOffset = 0;
  let lastStopsLength = 0;
  let lastPageSize = 1;
  let lastUpdateArgs = null;

  // Layout state - will be re-initialized on resize if orientation changes
  let isPortrait = false;
  let leftPane;
  let rightPane;

  function createPanes() {
    // Remove existing panes if they exist
    if (leftPane) leftPane.destroy();
    if (rightPane) rightPane.destroy();

    if (isPortrait) {
      // Stacked layout: 30% top (stops), 70% bottom (vehicles)
      leftPane = blessed.box({
        top: 0, left: 0,
        width: '100%',
        height: '30%',
        tags: true,
        border: { type: 'line' },
        scrollable: true,
        alwaysScroll: true,
        style: { border: { fg: COLORS.border }, bg: 'black' },
      });
      rightPane = blessed.box({
        top: '30%', left: 0,
        width: '100%',
        height: '70%',
        tags: true,
        border: { type: 'line' },
        label: ' Vehicles ',
        scrollable: true,
        alwaysScroll: true,
        style: { border: { fg: COLORS.border }, bg: 'black' },
      });
    } else {
      // Landscape layout: 50% left (stops), 50% right (vehicles)
      leftPane = blessed.box({
        top: 0, left: 0,
        width: '50%',
        height: '100%',
        tags: true,
        border: { type: 'line' },
        style: { border: { fg: COLORS.border }, bg: 'black' },
      });
      rightPane = blessed.box({
        top: 0, right: 0,
        width: '50%',
        height: '100%',
        tags: true,
        border: { type: 'line' },
        label: ' Vehicles ',
        scrollable: true,
        alwaysScroll: true,
        style: { border: { fg: COLORS.border }, bg: 'black' },
      });
    }
    box.append(leftPane);
    box.append(rightPane);

    leftPane.on('wheelup',    () => { leftPane.scroll(-3); getScreen().render(); });
    leftPane.on('wheeldown',  () => { leftPane.scroll(3);  getScreen().render(); });
    rightPane.on('wheelup',   () => { rightPane.scroll(-3); getScreen().render(); });
    rightPane.on('wheeldown', () => { rightPane.scroll(3);  getScreen().render(); });
  }

  // Re-render on terminal resize using the last known data
  getScreen().on('resize', () => {
    const screen = getScreen();
    const thresholdWidth = 80;
    const shouldBePortrait = screen.width < thresholdWidth;
    
    if (isPortrait !== shouldBePortrait) {
      isPortrait = shouldBePortrait;
      createPanes();
      if (lastUpdateArgs) update(...lastUpdateArgs);
    } else {
      if (lastUpdateArgs) update(...lastUpdateArgs);
    }
  });

  // Initialize panes based on initial screen size
  const initialScreen = getScreen();
  isPortrait = initialScreen.width < 80;
  createPanes();

  function update(buses, stops, extraStops, directionId, routeNumber = '87', predictions = {}) {
    lastUpdateArgs = [buses, stops, extraStops, directionId, routeNumber, predictions];
    const screen = getScreen();
    const contentHeight = screen.height - 2; // minus tab bar and status bar

    // Left pane inner width (subtract 2 for border)
    const leftInnerWidth = leftPane.width - 2;

    // In portrait mode, use 80/20 split (label/track) for narrow screens
    // In landscape mode, use 50/50 split

    // Compute visible stop window for scrolling
    const pageSize = contentHeight - 4; // rows available inside left pane (border + header)
    lastPageSize = pageSize;
    lastStopsLength = stops.length;
    scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, stops.length - pageSize)));
    const visibleStops = stops.slice(scrollOffset, scrollOffset + pageSize);

    buses.forEach(b => busColor(b.id, colorMap));

    const lookup = createStopLookup(stops, extraStops);
    const placed = placeBuses(buses, stops, lookup);
    const placedByVehicleId = Object.fromEntries(placed.map(p => [p.bus.id, p]));
    const placedIds = new Set(placed.map(p => p.bus.id));
    const unplaced = buses.filter(b => !placedIds.has(b.id));

    const segmentBuses = {};
    placed.forEach(p => {
      (segmentBuses[p.segmentIndex] ??= []).push(p);
    });

    const dir = DIRECTION_LABELS[directionId];
    const scrollInfo = stops.length > pageSize
      ? ` {${COLORS.inactive}-fg}[${scrollOffset + 1}–${Math.min(scrollOffset + pageSize, stops.length)}/${stops.length}]{/${COLORS.inactive}-fg}`
      : '';
    const header = `{bold}{${COLORS.cyan}-fg}Route ${routeNumber} — ${dir}{/${COLORS.cyan}-fg}{/bold}  {${COLORS.inactive}-fg}${buses.length} vehicle(s){/${COLORS.inactive}-fg}${scrollInfo}`;

    // Translate global segment indices to local (accounting for scroll offset)
    const localSegBuses = {};
    Object.entries(segmentBuses).forEach(([idx, placements]) => {
      const localIdx = parseInt(idx) - scrollOffset;
      if (localIdx >= 0 && localIdx < visibleStops.length - 1) {
        localSegBuses[localIdx] = placements;
      }
    });

    // Build stopName → earliest ETA string from predictions, for all vehicles
    const stopEtas = {};
    for (const vehiclePreds of Object.values(predictions)) {
      for (const p of vehiclePreds) {
        const time = p.arrivalTime ?? p.departureTime;
        if (!time) continue;
        const s = lookup(p.stopId);
        if (!s) continue;
        const eta = fmtEta(time);
        if (!eta) continue;
        // Keep the earliest ETA per stop name
        if (!stopEtas[s.name] || eta === 'now' || (stopEtas[s.name] !== 'now' && parseInt(eta) < parseInt(stopEtas[s.name]))) {
          stopEtas[s.name] = eta;
        }
      }
    }

    const hasMoreStops = (scrollOffset + pageSize) < stops.length;
    const stopLines = buses.length === 0
      ? ['{yellow-fg}No active vehicles.{/yellow-fg}']
      : renderColumn(visibleStops, localSegBuses, leftInnerWidth, hasMoreStops, colorMap, scrollOffset, stopEtas);

    leftPane.setContent('\n ' + header + '\n' + stopLines.join('\n'));

    updateInfoBox(buses, stops, extraStops, unplaced, colorMap, rightPane, predictions, placedByVehicleId, lookup);
    screen.render();
  }

  function scroll(delta) {
    if (!lastUpdateArgs) return;
    const maxOffset = Math.max(0, lastStopsLength - lastPageSize);
    scrollOffset = Math.max(0, Math.min(scrollOffset + delta, maxOffset));
    update(...lastUpdateArgs);
  }

  return { box, update, scroll };
}

function updateInfoBox(buses, stops, extraStops, unplaced, colorMap, rightPane, predictions, placedByVehicleId, lookup = null) {
  if (buses.length === 0) {
    rightPane.setContent(`{${COLORS.inactive}-fg}No vehicles{/${COLORS.inactive}-fg}`);
    return;
  }

  const INNER = rightPane.width - 2; // inner width accounts for border
  const finalLookup = lookup || createStopLookup(stops, extraStops);

  // Sort vehicles by their stop index so order matches the stop list top-to-bottom
  const sortedBuses = [...buses].sort((a, b) => {
    const pa = placedByVehicleId[a.id];
    const pb = placedByVehicleId[b.id];
    const ia = pa ? pa.stopIdx ?? pa.segmentIndex : Infinity;
    const ib = pb ? pb.stopIdx ?? pb.segmentIndex : Infinity;
    return ia - ib;
  });

  const divider = `{${COLORS.inactive}-fg}${'─'.repeat(INNER)}/{/${COLORS.inactive}-fg}`;

  const cards = sortedBuses.flatMap(bus => {
    const vehiclePreds = predictions[bus.id] ?? [];
    const placement = placedByVehicleId[bus.id] ?? null;
    const cardLines = renderVehicleCard(bus, placement, colorMap, stops, finalLookup, vehiclePreds, INNER);
    return [...cardLines, divider];
  });

  // Remove trailing divider
  cards.pop();

  rightPane.setContent(cards.join('\n'));
}
