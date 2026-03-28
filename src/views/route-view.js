import blessed from 'blessed';
import { getScreen } from '../screen.js';
import { placeBuses, busMarker, busColor, formatOccupancy } from '../utils.js';

/**
 * Create a route visualization view.
 * @returns {{ box: BlessedBox, update: function }}
 */
export function createRouteView() {
  const box = blessed.box({ tags: true });

  // Persistent color assignments so bus colors stay stable across refreshes
  const colorMap = new Map();

  // Info overlay — created once, lives in the lower-right corner
  const infoBox = blessed.box({
    bottom: 0,
    right: 0,
    width: 36,
    height: 6, // resized dynamically on each update
    tags: true,
    border: { type: 'line' },
    label: ' Buses ',
    style: { border: { fg: 'grey' }, bg: 'black' },
    content: '',
  });

  function update(buses, stops, directionId, routeNumber = '87') {
    const screen = getScreen();
    const screenWidth = screen.width;
    const boxHeight = box.height || (screen.height - 2);

    const placed = placeBuses(buses, stops);
    const placedIds = new Set(placed.map(p => p.bus.id));

    // Buses that couldn't be placed on any segment
    const unplaced = buses.filter(b => !placedIds.has(b.id));

    // Ensure all bus IDs have a color assigned (including unplaced)
    buses.forEach(b => busColor(b.id, colorMap));

    // Group placements by segment index
    const segmentBuses = {};
    placed.forEach(p => {
      (segmentBuses[p.segmentIndex] ??= []).push(p);
    });

    const numCols = screenWidth >= 180 ? 3 : screenWidth >= 110 ? 2 : 1;
    const colWidth = Math.floor(screenWidth / numCols);
    const stopsPerCol = Math.ceil(stops.length / numCols);

    const dir = directionId === 0 ? 'Outbound' : 'Inbound';
    const header = `{bold}{cyan-fg}MBTA Route ${routeNumber} — ${dir}{/cyan-fg}{/bold}  {grey-fg}${buses.length} bus(es) active{/grey-fg}`;

    box.children.slice().forEach(c => c.destroy());

    box.append(blessed.box({
      top: 0, left: 0, width: '100%', height: 2,
      tags: true, content: '\n ' + header,
    }));

    if (buses.length === 0) {
      box.append(blessed.box({
        top: 2, left: 0, width: '100%', height: 3,
        tags: true, content: '\n {yellow-fg}No active buses on this route.{/yellow-fg}',
      }));
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

      box.append(blessed.box({
        top: 2,
        left: col * colWidth,
        width: boxWidth,
        height: boxHeight - 2,
        tags: true,
        scrollable: true,
        keys: true,
        content: renderColumn(colStops, localSegBuses, innerWidth, hasMoreStops, colorMap).join('\n'),
        border: numCols > 1 ? { type: 'line' } : undefined,
        style: numCols > 1 ? { border: { fg: 'grey' } } : undefined,
      }));
    }

    // Update info overlay
    updateInfoBox(buses, unplaced, colorMap, infoBox);
    box.append(infoBox);

    screen.render();
  }

  return { box, update };
}

function updateInfoBox(buses, unplaced, colorMap, infoBox) {
  const lines = buses.map(bus => {
    const color = colorMap.get(bus.id) || 'white';
    const marker = busMarker(bus).char;
    const label = `Bus ${bus.label || bus.id}`.padEnd(10).slice(0, 10);
    const occ = formatOccupancy(bus.occupancyStatus);
    const flag = unplaced.some(u => u.id === bus.id) ? ' {grey-fg}?{/grey-fg}' : '';
    return `{${color}-fg}${marker} ${label}{/${color}-fg} {grey-fg}${occ}{/grey-fg}${flag}`;
  });

  infoBox.height = Math.min(buses.length + 2, 12);
  infoBox.setContent(lines.join('\n'));
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
      const char = busMarker(p.bus).char;
      marker = `{${color}-fg}${char}{/${color}-fg}`;
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
        const char = busMarker(p.bus).char;
        track[pos] = { color, char };
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
