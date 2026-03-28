import blessed from 'blessed';
import { calculateDistance, calculatePositionProportion } from './utils.js';

// Shared screen instance
let screen = null;
let mainBox = null;
let statusBar = null;
let routeOverlay = null;
let helpOverlay = null;
let onRouteSelect = null;
let cachedRoutes = []; // [{id, name}] populated after API fetch

/**
 * Update the cached route list (call after fetching from API)
 * @param {Array} routes - [{id, name}]
 */
export function setRouteList(routes) {
  cachedRoutes = routes;
}

/**
 * Initialize the blessed screen. Call once at startup.
 * @param {function} routeSelectCallback - Called with (routeNumber) when user picks a route
 */
export function initScreen(routeSelectCallback) {
  onRouteSelect = routeSelectCallback;

  screen = blessed.screen({
    smartCSR: true,
    title: 'MBTA Visualizer',
    fullUnicode: true,
    forceUnicode: true,
  });

  mainBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%-1',
    tags: true,
    scrollable: false,
    content: 'Loading...',
  });

  statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { bg: 'blue', fg: 'white' },
    content: ' [r] change route  [d] toggle direction  [q] quit  [?] help',
  });

  screen.append(mainBox);
  screen.append(statusBar);

  // Keyboard bindings
  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key('r', () => showRouteOverlay());
  screen.key('?', () => showHelpOverlay());

  screen.render();
  return screen;
}

/**
 * Show the route selector overlay
 */
function showRouteOverlay() {
  if (routeOverlay) {
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
    return;
  }

  const routes = cachedRoutes.length > 0 ? cachedRoutes : [{ id: '…', name: 'Loading routes…' }];
  const items = routes.map(r => `  ${r.id.padEnd(6)} ${r.name}`);

  routeOverlay = blessed.list({
    top: 'center',
    left: 'center',
    width: 46,
    height: Math.min(routes.length + 2, Math.floor(screen.height * 0.8)),
    border: { type: 'line' },
    label: ' Select Route (↑↓ navigate, Enter select) ',
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    style: {
      selected: { bg: 'blue', fg: 'white' },
      border: { fg: 'cyan' },
    },
    items,
  });

  routeOverlay.key(['escape', 'r'], () => {
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
  });

  routeOverlay.on('select', (_item, index) => {
    const route = routes[index];
    if (!route || route.id === '…') return;
    routeOverlay.destroy();
    routeOverlay = null;
    screen.render();
    if (onRouteSelect) onRouteSelect(route.id);
  });

  screen.append(routeOverlay);
  routeOverlay.focus();
  screen.render();
}

/**
 * Show the help overlay
 */
function showHelpOverlay() {
  if (helpOverlay) {
    helpOverlay.destroy();
    helpOverlay = null;
    screen.render();
    return;
  }

  helpOverlay = blessed.box({
    top: 'center',
    left: 'center',
    width: 44,
    height: 14,
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    style: { border: { fg: 'yellow' } },
    content: [
      '',
      '  {bold}Keyboard Shortcuts{/bold}',
      '',
      '  {cyan-fg}r{/cyan-fg}   Open route selector',
      '  {cyan-fg}d{/cyan-fg}   Toggle direction (via route select)',
      '  {cyan-fg}?{/cyan-fg}   Toggle this help',
      '  {cyan-fg}q{/cyan-fg}   Quit',
      '',
      '  {bold}Bus Status Icons{/bold}',
      '',
      '  {yellow-fg}■{/yellow-fg}  STOPPED_AT    {green-fg}▶{/green-fg}  IN_TRANSIT_TO',
      '  {cyan-fg}▷{/cyan-fg}  INCOMING_AT',
    ].join('\n'),
  });

  helpOverlay.key(['escape', '?'], () => {
    helpOverlay.destroy();
    helpOverlay = null;
    screen.render();
  });

  screen.append(helpOverlay);
  helpOverlay.focus();
  screen.render();
}

/**
 * Update the status bar text
 */
export function setStatus(text) {
  if (statusBar) {
    statusBar.setContent(` ${text}  {|}  [r] route  [?] help  [q] quit`);
    screen.render();
  }
}

/**
 * Get direction label from direction_id
 */
export function getDirectionLabel(directionId) {
  return directionId === 0 ? 'Outbound' : 'Inbound';
}

/**
 * Find which segment a bus is in
 */
export function findBusSegment(bus, stops) {
  if (!bus || !bus.latitude || !bus.longitude || !stops || stops.length < 2) {
    return null;
  }

  // Find the closest segment
  let bestSegment = null;
  let bestDist = Infinity;

  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];

    if (!stop1 || !stop2 || !stop1.latitude || !stop2.latitude) continue;

    const dist1 = calculateDistance(bus.latitude, bus.longitude, stop1.latitude, stop1.longitude);
    const dist2 = calculateDistance(bus.latitude, bus.longitude, stop2.latitude, stop2.longitude);
    const minDist = Math.min(dist1, dist2);

    if (minDist < bestDist) {
      bestDist = minDist;
      const proportion = calculatePositionProportion(
        bus.latitude, bus.longitude,
        stop1.latitude, stop1.longitude,
        stop2.latitude, stop2.longitude
      );
      bestSegment = { segmentIndex: i, stop1, stop2, proportion, bus };
    }
  }

  return bestSegment;
}

/**
 * Get bus marker character and color tag based on status
 */
function busMarker(bus) {
  switch (bus.currentStatus) {
    case 'STOPPED_AT':    return { char: '■', color: 'yellow' };
    case 'INCOMING_AT':   return { char: '▷', color: 'cyan' };
    case 'IN_TRANSIT_TO': return { char: '▶', color: 'green' };
    default:              return { char: '▶', color: 'white' };
  }
}

/**
 * Render one column's worth of stops as a string (blessed tags supported)
 * @param {number} innerWidth - usable inner width (already minus border chars)
 */
function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false) {
  const LABEL_WIDTH = Math.floor(innerWidth / 2) - 2; // half the row for the name
  // total line: 1(marker) + 1(space) + LABEL_WIDTH + 1(space) + trackWidth = innerWidth
  const trackWidth = Math.max(4, innerWidth - LABEL_WIDTH - 3);
  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop || !stop.name) continue;

    // Buses stopped at or incoming to this stop
    const atStop = [];
    Object.values(segmentBuses).forEach(busesInSeg => {
      busesInSeg.forEach(b => {
        if ((b.currentStatus === 'STOPPED_AT' || b.currentStatus === 'INCOMING_AT') &&
            b._segmentStopIdx === i) {
          atStop.push(b);
        }
      });
    });

    // Buses in transit from this stop toward next (segment i)
    const inTransit = (segmentBuses[i] || []).filter(
      b => b.currentStatus === 'IN_TRANSIT_TO' || b.currentStatus === 'UNKNOWN'
    );

    const rawName = stop.name.length > LABEL_WIDTH
      ? stop.name.slice(0, LABEL_WIDTH - 1) + '…'
      : stop.name.padEnd(LABEL_WIDTH);

    const hasActivity = atStop.length > 0 || inTransit.length > 0;
    let marker = '{grey-fg}◉{/grey-fg}';
    if (atStop.length > 0) {
      const m = busMarker(atStop[0]);
      marker = `{${m.color}-fg}${m.char}{/${m.color}-fg}`;
    }
    const nameTag = hasActivity ? `{white-fg}${rawName}{/white-fg}` : `{grey-fg}${rawName}{/grey-fg}`;

    // Draw track for all stops except the absolute last stop of the route
    // (last stop in a column slice still gets a track since the route continues)
    const isRouteEnd = i === stops.length - 1 && !hasMoreStops;
    let trackPart = '';
    if (!isRouteEnd) {
      const track = Array(trackWidth).fill('·');
      track[0] = '╎';

      inTransit.forEach(b => {
        const pos = Math.max(1, Math.min(trackWidth - 2, Math.floor(b._proportion * (trackWidth - 2)) + 1));
        const m = busMarker(b);
        track[pos] = { color: m.color, char: m.char };
      });

      let built = ' ';
      for (const ch of track) {
        if (typeof ch === 'object') {
          built += `{${ch.color}-fg}${ch.char}{/${ch.color}-fg}`;
        } else {
          built += `{grey-fg}${ch}{/grey-fg}`;
        }
      }
      trackPart = built;
    }

    lines.push(`${marker} ${nameTag}${trackPart}`);
  }

  return lines;
}

/**
 * Main render function — updates the blessed screen content
 */
export function renderVisualization(buses, stops, directionId, routeNumber = '87') {
  if (!screen || !mainBox) return;

  const screenWidth = screen.width;
  const screenHeight = screen.height - 1; // minus status bar

  // Assign each bus to its segment with proportion
  const segmentBuses = {};
  buses.forEach(bus => {
    const seg = findBusSegment(bus, stops);
    if (!seg) return;
    const { segmentIndex, proportion, stop1, stop2 } = seg;

    // Determine which stop index the bus is "at" based on status
    let stopIdx = segmentIndex; // default: the stop before this segment
    if (bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT') {
      // Snap to nearest stop
      stopIdx = proportion > 0.5 ? segmentIndex + 1 : segmentIndex;
    }

    const enriched = { ...bus, _proportion: proportion, _segmentStopIdx: stopIdx };
    if (!segmentBuses[segmentIndex]) segmentBuses[segmentIndex] = [];
    segmentBuses[segmentIndex].push(enriched);
  });

  // Determine number of columns based on terminal width
  const numCols = screenWidth >= 180 ? 3 : screenWidth >= 110 ? 2 : 1;
  const colWidth = Math.floor(screenWidth / numCols);

  // Split stops across columns
  const stopsPerCol = Math.ceil(stops.length / numCols);

  // Build header
  const dir = getDirectionLabel(directionId);
  const header = `{bold}{cyan-fg}MBTA Route ${routeNumber} — ${dir}{/cyan-fg}{/bold}  {grey-fg}${buses.length} bus(es) active{/grey-fg}`;

  // Destroy and recreate column boxes to handle resize
  mainBox.children.slice().forEach(c => c.destroy());

  // Header box
  const headerBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 2,
    tags: true,
    content: '\n ' + header,
  });
  mainBox.append(headerBox);

  if (buses.length === 0) {
    const msgBox = blessed.box({
      top: 2,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      content: '\n {yellow-fg}No active buses on this route.{/yellow-fg}',
    });
    mainBox.append(msgBox);
    screen.render();
    return;
  }

  for (let col = 0; col < numCols; col++) {
    const startIdx = col * stopsPerCol;
    const endIdx = Math.min(startIdx + stopsPerCol + 1, stops.length); // +1 to overlap last stop
    const colStops = stops.slice(startIdx, endIdx);

    // Build a local segmentBuses map offset by startIdx
    const localSegBuses = {};
    Object.entries(segmentBuses).forEach(([idx, buses]) => {
      const localIdx = parseInt(idx) - startIdx;
      if (localIdx >= 0 && localIdx < colStops.length - 1) {
        localSegBuses[localIdx] = buses;
      }
    });

    const boxWidth = col < numCols - 1 ? colWidth : screenWidth - col * colWidth;
    // Inner usable width: subtract 2 for left+right border when bordered
    const innerWidth = numCols > 1 ? boxWidth - 2 : boxWidth;
    const hasMoreStops = endIdx < stops.length;
    const lines = renderColumn(colStops, localSegBuses, innerWidth, hasMoreStops);
    const content = lines.join('\n');

    const colBox = blessed.box({
      top: 2,
      left: col * colWidth,
      width: boxWidth,
      height: screenHeight - 2,
      tags: true,
      scrollable: true,
      keys: true,
      content,
      border: numCols > 1 ? { type: 'line' } : undefined,
      style: numCols > 1 ? { border: { fg: 'grey' } } : undefined,
    });

    mainBox.append(colBox);
  }

  screen.render();
}

/**
 * Destroy the screen (cleanup)
 */
export function destroyScreen() {
  if (screen) {
    screen.destroy();
    screen = null;
  }
}
