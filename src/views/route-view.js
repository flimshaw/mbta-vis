import blessed from 'blessed';
import { getScreen } from '../screen.js';
import { placeBuses, busMarker, busColor, formatOccupancy } from '../utils.js';

/**
 * Create a route visualization view.
 * @returns {{ box: BlessedBox, update: function }}
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

  // Info overlay — lives outside the destroy loop so it's never recreated
  const infoBox = blessed.box({
    bottom: 0,
    right: 0,
    width: 68,
    height: 4,
    tags: true,
    border: { type: 'line' },
    label: ' Vehicles ',
    style: { border: { fg: 'grey' }, bg: 'black' },
  });
  // Content area — all route rendering goes here; this is what gets cleared
  const contentBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    tags: true,
  });
  box.append(contentBox);
  box.append(infoBox); // appended after contentBox so it renders on top

  // Re-render on terminal resize using the last known data
  getScreen().on('resize', () => { if (lastUpdateArgs) update(...lastUpdateArgs); });

  function update(buses, stops, extraStops, directionId, routeNumber = '87', predictions = {}) {
    lastUpdateArgs = [buses, stops, extraStops, directionId, routeNumber, predictions];
    const screen = getScreen();
    const screenWidth = screen.width;
    const contentHeight = screen.height - 2; // minus tab bar and status bar

    // Compute visible stop window for scrolling
    const pageSize = contentHeight - 3; // rows available below header
    lastPageSize = pageSize;
    lastStopsLength = stops.length;
    scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, stops.length - pageSize)));
    const visibleStops = stops.slice(scrollOffset, scrollOffset + pageSize);

    buses.forEach(b => busColor(b.id, colorMap));

    const placed = placeBuses(buses, stops);
    const placedByVehicleId = Object.fromEntries(placed.map(p => [p.bus.id, p]));
    const placedIds = new Set(placed.map(p => p.bus.id));
    const unplaced = buses.filter(b => !placedIds.has(b.id));

    const segmentBuses = {};
    placed.forEach(p => {
      (segmentBuses[p.segmentIndex] ??= []).push(p);
    });

    // Single column (left half) unless the full stop list exceeds one column's height,
    // in which case use two columns each at half width.
    const numCols = stops.length > pageSize ? 2 : 1;
    const colWidth = Math.floor(screenWidth / 2);
    const stopsPerCol = Math.ceil(visibleStops.length / numCols);

    const dir = directionId === 0 ? 'Outbound' : 'Inbound';
    const scrollInfo = stops.length > pageSize
      ? `  {grey-fg}[${scrollOffset + 1}–${Math.min(scrollOffset + pageSize, stops.length)}/${stops.length}]{/grey-fg}`
      : '';
    const header = `{bold}{cyan-fg}MBTA Route ${routeNumber} — ${dir}{/cyan-fg}{/bold}  {grey-fg}${buses.length} vehicle(s) active{/grey-fg}${scrollInfo}`;

    // Clear only the content area, not infoBox
    contentBox.children.slice().forEach(c => c.destroy());

    contentBox.append(blessed.box({
      top: 0, left: 0, width: '100%', height: 2,
      tags: true, content: '\n ' + header,
    }));

    if (buses.length === 0) {
      contentBox.append(blessed.box({
        top: 2, left: 0, width: '100%', height: 3,
        tags: true, content: '\n {yellow-fg}No active vehicles on this route.{/yellow-fg}',
      }));
      updateInfoBox([], stops, extraStops, [], colorMap, infoBox, {}, {});
      screen.render();
      return;
    }

    for (let col = 0; col < numCols; col++) {
      const startIdx = col * stopsPerCol;
      const endIdx = Math.min(startIdx + stopsPerCol + 1, visibleStops.length);
      const colStops = visibleStops.slice(startIdx, endIdx);

      // Translate global segment indices to local (accounting for scroll offset)
      const globalStartIdx = scrollOffset + startIdx;
      const localSegBuses = {};
      Object.entries(segmentBuses).forEach(([idx, placements]) => {
        const localIdx = parseInt(idx) - globalStartIdx;
        if (localIdx >= 0 && localIdx < colStops.length - 1) {
          localSegBuses[localIdx] = placements;
        }
      });

      const boxWidth = colWidth;
      const innerWidth = boxWidth - 2;
      const hasMoreStops = (scrollOffset + endIdx) < stops.length;

      contentBox.append(blessed.box({
        top: 2,
        left: col * colWidth,
        width: boxWidth,
        height: contentHeight - 2,
        tags: true,
        content: renderColumn(colStops, localSegBuses, innerWidth, hasMoreStops, colorMap, globalStartIdx).join('\n'),
        border: { type: 'line' },
        style: { border: { fg: 'grey' } },
      }));
    }

    updateInfoBox(buses, stops, extraStops, unplaced, colorMap, infoBox, predictions, placedByVehicleId);
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

// Occupancy levels in increasing order, used to build the fill bar
const OCCUPANCY_LEVELS = [
  { status: 'EMPTY',                      filled: 0, color: 'green'   },
  { status: 'MANY_SEATS_AVAILABLE',       filled: 1, color: 'green'   },
  { status: 'FEW_SEATS_AVAILABLE',        filled: 2, color: 'yellow'  },
  { status: 'STANDING_ROOM_ONLY',         filled: 3, color: 'yellow'  },
  { status: 'CRUSHED_STANDING_ROOM_ONLY', filled: 4, color: 'red'     },
  { status: 'FULL',                       filled: 5, color: 'red'     },
  { status: 'NOT_ACCEPTING_PASSENGERS',   filled: 5, color: 'red'     },
  { status: 'NO_DATA_AVAILABLE',          filled: 0, color: 'grey'    },
];
const BAR_TOTAL = 5;

function occupancyBar(status) {
  if (status === 'NOT_ACCEPTING_PASSENGERS') return '{red-fg}[×××××]{/red-fg}';
  const level = OCCUPANCY_LEVELS.find(l => l.status === status);
  if (!level) return '{grey-fg}[·····]{/grey-fg}';
  const filled = '█'.repeat(level.filled) + '·'.repeat(BAR_TOTAL - level.filled);
  return `{${level.color}-fg}[${filled}]{/${level.color}-fg}`;
}

// Format a prediction arrival/departure time as a relative ETA string.
function fmtEta(isoTime) {
  if (!isoTime) return null;
  const diffMs = new Date(isoTime) - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) return null; // already passed
  if (diffMin === 0) return 'now';
  return `${diffMin}m`;
}

// Return the ETA string for a prediction matching targetStopName, or null.
function etaForStop(vehiclePreds, targetStopName, stopById, extraStopById) {
  for (const p of vehiclePreds) {
    const s = stopById[p.stopId] ?? extraStopById[p.stopId];
    if (!s || s.name !== targetStopName) continue;
    const time = p.arrivalTime ?? p.departureTime;
    const eta = fmtEta(time);
    if (eta) return eta;
  }
  return null;
}

// Build 1–2 status lines for a vehicle card, using placement indices so stop
// names are always sourced from the route stop list (not child stop IDs).
function statusLines(bus, placement, stops, stopById, extraStopById, vehiclePreds, INNER) {
  if (!placement) {
    // Unplaced vehicle — best-effort from raw stop lookup
    const s = extraStopById[bus.currentStopId] ?? stopById[bus.currentStopId];
    return [`{grey-fg}→ {white-fg}${s?.name ?? ''}{/white-fg}{/grey-fg}`];
  }

  if (bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT') {
    const currentStop = stops[placement.stopIdx];
    const line1 = `{grey-fg}at {white-fg}${currentStop?.name ?? ''}{/white-fg}{/grey-fg}`;

    // Next: first future prediction for a stop with a different name than current
    const currentName = currentStop?.name ?? '';
    for (const p of vehiclePreds) {
      const s = stopById[p.stopId] ?? extraStopById[p.stopId];
      if (!s || s.name === currentName) continue;
      const time = p.arrivalTime ?? p.departureTime;
      const eta = fmtEta(time);
      if (!eta) continue;
      return [line1, `{grey-fg}next: {white-fg}${s.name}{/white-fg} in {cyan-fg}${eta}{/cyan-fg}{/grey-fg}`];
    }
    return [line1];
  }

  // IN_TRANSIT_TO / UNKNOWN — show from → dest with inline ETA
  const fromStop = stops[placement.segmentIndex];
  const destStop = stops[placement.segmentIndex + 1];
  const destName = destStop?.name ?? '';
  const eta = etaForStop(vehiclePreds, destName, stopById, extraStopById);
  const etaSuffix = eta ? ` {cyan-fg}in ${eta}{/cyan-fg}` : '';

  const maxHalf = Math.floor((INNER - 5) / 2);
  const from = (fromStop?.name ?? '').slice(0, maxHalf);
  const dest = destName.slice(0, maxHalf);

  const line = from
    ? `{grey-fg}{white-fg}${from}{/white-fg} → {white-fg}${dest}{/white-fg}${etaSuffix}{/grey-fg}`
    : `{grey-fg}→ {white-fg}${dest}{/white-fg}${etaSuffix}{/grey-fg}`;
  return [line];
}

function miniCarBar(carriage) {
  if (carriage.occupancyStatus === 'NOT_ACCEPTING_PASSENGERS') {
    return '{red-fg}[×××××]{/red-fg}';
  }
  if (!carriage.occupancyStatus || carriage.occupancyStatus === 'NO_DATA_AVAILABLE') {
    return '{grey-fg}[·····]{/grey-fg}';
  }
  const level = OCCUPANCY_LEVELS.find(l => l.status === carriage.occupancyStatus);
  // Prefer status-based fill so color and fill are always consistent.
  // Fall back to percentage only when status is absent or carries no fill info.
  const filled = level
    ? level.filled
    : carriage.occupancyPercentage != null
      ? Math.min(5, Math.round(carriage.occupancyPercentage / 20))
      : 0;
  const color = level?.color ?? 'grey';
  const bar = '█'.repeat(filled) + '·'.repeat(5 - filled);
  return `{${color}-fg}[${bar}]{/${color}-fg}`;
}


function renderBusCard(bus, placement, colorMap, stops, extraStopById, stopById, vehiclePreds, INNER) {
  const color = colorMap.get(bus.id) || 'white';
  const char = busMarker(bus).char;
  const revenue = bus.revenue ? '{green-fg}✓{/green-fg}' : '{red-fg}✗{/red-fg}';
  const label = (bus.label || bus.id).slice(0, 6);
  const speedStr = `${bus.speed != null ? Math.round(bus.speed) : 0}km/h`;

  const occupancyText = bus.occupancyStatus ? `{grey-fg}${formatOccupancy(bus.occupancyStatus)}{/grey-fg}` : '';
  const line1Left = `{${color}-fg}${char} #${label}{/${color}-fg} ${revenue}${occupancyText ? ' ' + occupancyText : ''}`;
  const line1Right = `{grey-fg}${speedStr}{/grey-fg}`;
  const line1 = padBetween(line1Left, line1Right, INNER);
  return [line1, ...statusLines(bus, placement, stops, stopById, extraStopById, vehiclePreds, INNER)];
}

function renderSubwayCard(bus, placement, colorMap, stops, extraStopById, stopById, vehiclePreds, INNER) {
  const color = colorMap.get(bus.id) || 'white';
  const char = busMarker(bus).char;
  const revenue = bus.revenue ? '{green-fg}✓{/green-fg}' : '{red-fg}✗{/red-fg}';
  const label = (bus.label || bus.id).slice(0, 10);
  const speedStr = `${bus.speed != null ? Math.round(bus.speed) : 0}km/h`;

  const occupancyText = bus.occupancyStatus ? `{grey-fg}${formatOccupancy(bus.occupancyStatus)}{/grey-fg}` : '';
  const line1Left = `{${color}-fg}${char} #${label}{/${color}-fg} ${revenue}${occupancyText ? ' ' + occupancyText : ''}`;
  const line1Right = `{grey-fg}${speedStr}{/grey-fg}`;
  const line1 = padBetween(line1Left, line1Right, INNER);

  const carBars = bus.carriages.map((c, i) => `{grey-fg}${i + 1}{/grey-fg}${miniCarBar(c)}`).join(' ');
  const line2 = carBars || '{grey-fg}no car data{/grey-fg}';

  return [line1, line2, ...statusLines(bus, placement, stops, stopById, extraStopById, vehiclePreds, INNER)];
}

function updateInfoBox(buses, stops, extraStops, unplaced, colorMap, infoBox, predictions, placedByVehicleId) {
  if (buses.length === 0) {
    infoBox.height = 3;
    infoBox.setContent('{grey-fg}No vehicles{/grey-fg}');
    return;
  }

  const stopById = {};
  stops.forEach(s => { stopById[s.id] = s; });
  const extraStopById = {};
  extraStops.forEach(s => { extraStopById[s.id] = s; });

  const INNER = 66; // infoBox width (68) minus 2 for border
  const divider = `{grey-fg}${'─'.repeat(INNER)}{/grey-fg}`;

  const cards = buses.flatMap(bus => {
    const vehiclePreds = predictions[bus.id] ?? [];
    const placement = placedByVehicleId[bus.id] ?? null;
    const cardLines = bus.carriages.length > 0
      ? renderSubwayCard(bus, placement, colorMap, stops, extraStopById, stopById, vehiclePreds, INNER)
      : renderBusCard(bus, placement, colorMap, stops, extraStopById, stopById, vehiclePreds, INNER);
    return [...cardLines, divider];
  });

  // Remove trailing divider
  cards.pop();

  infoBox.height = cards.length + 2;
  infoBox.setContent(cards.join('\n'));
}

// Lay out left and right text in a fixed-width field.
// Strips blessed tags ({anything}) before measuring visible character width.
function padBetween(left, right, totalWidth) {
  const visibleLen = s => s.replace(/\{\/?\w[\w-]*\}/g, '').length;
  const gap = Math.max(1, totalWidth - visibleLen(left) - visibleLen(right));
  return left + ' '.repeat(gap) + right;
}

function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false, colorMap = new Map(), globalOffset = 0) {
  const LABEL_WIDTH = Math.floor(innerWidth / 2) - 2;
  const trackWidth = Math.max(4, innerWidth - LABEL_WIDTH - 3);
  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop?.name) continue;

    const atStop = Object.values(segmentBuses).flat().filter(
      p => (p.bus.currentStatus === 'STOPPED_AT' || p.bus.currentStatus === 'INCOMING_AT')
        && p.stopIdx === i + globalOffset
    );

    const inTransit = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'IN_TRANSIT_TO' || p.bus.currentStatus === 'UNKNOWN'
    );

    const rawName = stop.name.length > LABEL_WIDTH
      ? stop.name.slice(0, LABEL_WIDTH - 1) + '…'
      : stop.name.padEnd(LABEL_WIDTH);

    const hasActivity = atStop.length > 0 || inTransit.length > 0;

    let marker = '{grey-fg}◉{/grey-fg}';
    if (atStop.length > 0) {
      const p = atStop[0];
      const color = colorMap.get(p.bus.id) || 'white';
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
    }

    const nameTag = hasActivity
      ? `{white-fg}${rawName}{/white-fg}`
      : `{grey-fg}${rawName}{/grey-fg}`;

    let trackPart = '';
    if (!(i === stops.length - 1 && !hasMoreStops)) {
      const track = Array(trackWidth).fill('·');
      track[0] = '╎';

      inTransit.forEach(p => {
        const pos = Math.max(1, Math.min(trackWidth - 2, Math.floor(p.proportion * (trackWidth - 2)) + 1));
        const color = colorMap.get(p.bus.id) || 'white';
        track[pos] = { color, char: busMarker(p.bus).char };
      });

      trackPart = ' ' + track.map(ch =>
        typeof ch === 'object'
          ? `{${ch.color}-fg}${ch.char}{/${ch.color}-fg}`
          : `{grey-fg}${ch}{/grey-fg}`
      ).join('');
    }

    lines.push(`${marker} ${nameTag}${trackPart}`);
  }

  return lines;
}
