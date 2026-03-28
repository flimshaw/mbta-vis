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

  // Info overlay — lives outside the destroy loop so it's never recreated
  const infoBox = blessed.box({
    bottom: 0,
    right: 0,
    width: 68,
    height: 4,
    tags: true,
    border: { type: 'line' },
    label: ' Buses ',
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

  function update(buses, stops, directionId, routeNumber = '87') {
    const screen = getScreen();
    const screenWidth = screen.width;
    const contentHeight = screen.height - 2; // minus tab bar and status bar

    buses.forEach(b => busColor(b.id, colorMap));

    const placed = placeBuses(buses, stops);
    const placedIds = new Set(placed.map(p => p.bus.id));
    const unplaced = buses.filter(b => !placedIds.has(b.id));

    const segmentBuses = {};
    placed.forEach(p => {
      (segmentBuses[p.segmentIndex] ??= []).push(p);
    });

    const numCols = screenWidth >= 180 ? 3 : screenWidth >= 110 ? 2 : 1;
    const colWidth = Math.floor(screenWidth / numCols);
    const stopsPerCol = Math.ceil(stops.length / numCols);

    const dir = directionId === 0 ? 'Outbound' : 'Inbound';
    const header = `{bold}{cyan-fg}MBTA Route ${routeNumber} — ${dir}{/cyan-fg}{/bold}  {grey-fg}${buses.length} bus(es) active{/grey-fg}`;

    // Clear only the content area, not infoBox
    contentBox.children.slice().forEach(c => c.destroy());

    contentBox.append(blessed.box({
      top: 0, left: 0, width: '100%', height: 2,
      tags: true, content: '\n ' + header,
    }));

    if (buses.length === 0) {
      contentBox.append(blessed.box({
        top: 2, left: 0, width: '100%', height: 3,
        tags: true, content: '\n {yellow-fg}No active buses on this route.{/yellow-fg}',
      }));
      updateInfoBox([], stops, [], colorMap, infoBox);
      screen.render();
      return;
    }

    for (let col = 0; col < numCols; col++) {
      const startIdx = col * stopsPerCol;
      const endIdx = Math.min(startIdx + stopsPerCol + 1, stops.length);
      const colStops = stops.slice(startIdx, endIdx);

      const localSegBuses = {};
      Object.entries(segmentBuses).forEach(([idx, placements]) => {
        const localIdx = parseInt(idx) - startIdx;
        if (localIdx >= 0 && localIdx < colStops.length - 1) {
          localSegBuses[localIdx] = placements;
        }
      });

      const boxWidth = col < numCols - 1 ? colWidth : screenWidth - col * colWidth;
      const innerWidth = numCols > 1 ? boxWidth - 2 : boxWidth;
      const hasMoreStops = endIdx < stops.length;

      contentBox.append(blessed.box({
        top: 2,
        left: col * colWidth,
        width: boxWidth,
        height: contentHeight - 2,
        tags: true,
        scrollable: true,
        keys: true,
        content: renderColumn(colStops, localSegBuses, innerWidth, hasMoreStops, colorMap).join('\n'),
        border: numCols > 1 ? { type: 'line' } : undefined,
        style: numCols > 1 ? { border: { fg: 'grey' } } : undefined,
      }));
    }

    updateInfoBox(buses, stops, unplaced, colorMap, infoBox);
    screen.render();
  }

  return { box, update };
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
];
const BAR_TOTAL = 5;

function occupancyBar(status) {
  const level = OCCUPANCY_LEVELS.find(l => l.status === status);
  if (!level) return '{grey-fg}[·····]{/grey-fg}';
  const filled = '█'.repeat(level.filled) + '·'.repeat(BAR_TOTAL - level.filled);
  return `{${level.color}-fg}[${filled}]{/${level.color}-fg}`;
}

function updateInfoBox(buses, stops, unplaced, colorMap, infoBox) {
  if (buses.length === 0) {
    infoBox.height = 3;
    infoBox.setContent('{grey-fg}No buses{/grey-fg}');
    return;
  }

  const stopById = {};
  stops.forEach(s => { stopById[s.id] = s; });

  const INNER = 66; // infoBox width (68) minus 2 for border

  const cards = buses.flatMap(bus => {
    const color = colorMap.get(bus.id) || 'white';
    const char = busMarker(bus).char;
    const revenue = bus.revenue ? '{green-fg}✓{/green-fg}' : '{red-fg}✗{/red-fg}';
    const label = (bus.label || bus.id).slice(0, 6);
    const speedKmh = bus.speed != null ? Math.round(bus.speed) : 0;
    const speedStr = `${speedKmh} km/h`;

    // Line 1: marker + label + revenue + speed
    const line1Left = `{${color}-fg}${char} Bus ${label}{/${color}-fg} ${revenue}`;
    const line1Right = `{grey-fg}${speedStr}{/grey-fg}`;
    const line1 = padBetween(line1Left, line1Right, INNER);

    // Line 2: status + stop name
    const statusShort = {
      'STOPPED_AT':    'at',
      'INCOMING_AT':   '→',
      'IN_TRANSIT_TO': '→',
    }[bus.currentStatus] ?? '?';
    const stopName = (stopById[bus.currentStopId]?.name ?? '').slice(0, INNER - 4);
    const line2 = `{grey-fg}${statusShort} {white-fg}${stopName}{/white-fg}{/grey-fg}`;

    // Line 3: occupancy bar
    const line3 = occupancyBar(bus.occupancyStatus);

    return [line1, line2, line3, `{grey-fg}${'─'.repeat(INNER)}{/grey-fg}`];
  });

  // Remove trailing divider
  cards.pop();

  infoBox.height = cards.length + 2;
  infoBox.setContent(cards.join('\n'));
}

// Lay out left and right text in a fixed-width field.
// Tag characters don't count toward visible width so we measure raw visible chars.
function padBetween(left, right, totalWidth) {
  const visibleLen = s => s.replace(/\{[^}]+\}/g, '').length;
  const gap = Math.max(1, totalWidth - visibleLen(left) - visibleLen(right));
  return left + ' '.repeat(gap) + right;
}

function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false, colorMap = new Map()) {
  const LABEL_WIDTH = Math.floor(innerWidth / 2) - 2;
  const trackWidth = Math.max(4, innerWidth - LABEL_WIDTH - 3);
  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop?.name) continue;

    const atStop = Object.values(segmentBuses).flat().filter(
      p => (p.bus.currentStatus === 'STOPPED_AT' || p.bus.currentStatus === 'INCOMING_AT')
        && p.stopIdx === i
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
