import { calculateDistance, calculatePositionProportion } from './utils.js';
import chalk from 'chalk';

const WIDTH = 80;
const STOP_LABEL_WIDTH = 12;

/**
 * Get direction label from direction_id
 * @param {number} directionId - 0 for outbound, 1 for inbound
 * @returns {string} - Direction label
 */
export function getDirectionLabel(directionId) {
  return directionId === 0 ? 'Outbound (Clarendon Hill)' : 'Inbound (Lechmere)';
}

/**
 * Find which segment a bus is in
 * @param {object} bus - Bus data with lat/lon
 * @param {Array} stops - Array of stop objects
 * @returns {object|null} - Segment info or null
 */
export function findBusSegment(bus, stops) {
  if (!bus || !bus.latitude || !bus.longitude || !stops || stops.length < 2) {
    return null;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];

    if (!stop1 || !stop2 || !stop1.latitude || !stop2.latitude) {
      continue;
    }

    const dist1 = calculateDistance(
      bus.latitude, bus.longitude,
      stop1.latitude, stop1.longitude
    );
    const dist2 = calculateDistance(
      bus.latitude, bus.longitude,
      stop2.latitude, stop2.longitude
    );

    // If bus is closer to either stop, it's in this segment
    if (dist1 < 500 || dist2 < 500) { // Within 500m of a stop
      const proportion = calculatePositionProportion(
        bus.latitude, bus.longitude,
        stop1.latitude, stop1.longitude,
        stop2.latitude, stop2.longitude
      );

      return {
        segmentIndex: i,
        stop1,
        stop2,
        proportion,
        bus
      };
    }
  }

  return null;
}

/**
 * Render the ASCII visualization
 * @param {Array} buses - Array of bus objects
 * @param {Array} stops - Array of stop objects
 * @param {number} directionId - Current direction (0 or 1)
 * @param {string} routeNumber - Route number for display
 * @returns {string} - ASCII visualization string
 */
export function renderVisualization(buses, stops, directionId, routeNumber = '87') {
  const lines = [];
  
  // Header
  lines.push('='.repeat(WIDTH));
  lines.push(`MBTA Route ${routeNumber} - ${getDirectionLabel(directionId)}`);
  lines.push('='.repeat(WIDTH));
  lines.push('');

  if (buses.length === 0) {
    lines.push('No active buses on this route');
    lines.push('');
    return lines.join('\n');
  }

  // Process each bus and find its segment
  const busSegments = buses
    .map(bus => findBusSegment(bus, stops))
    .filter(segment => segment !== null);

  if (busSegments.length === 0) {
    lines.push('No buses currently on route segment');
    lines.push('(buses may be outside the tracked area)');
    lines.push('');
    return lines.join('\n');
  }

  // Group buses by segment
  const segmentBuses = {};
  busSegments.forEach(segment => {
    const key = segment.segmentIndex;
    if (!segmentBuses[key]) {
      segmentBuses[key] = [];
    }
    segmentBuses[key].push(segment.bus);
  });

  // Render each segment
  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];
    
    if (!stop1 || !stop2 || !stop1.name || !stop2.name) {
      continue;
    }

    const segmentBusesHere = segmentBuses[i] || [];
    
    // Render stop 1
    const stop1Line = formatStopLine(stop1.name, segmentBusesHere);
    lines.push(stop1Line);
    
    // Render connection line between stops
    const gap = WIDTH - STOP_LABEL_WIDTH - 2;
    const busMarkers = segmentBusesHere.map(b => {
      const pos = Math.floor(b.proportion * gap);
      return { pos };
    });
    
  }
  
  // Render the last stop separately
  const lastStop = stops[stops.length - 1];
  if (lastStop && lastStop.name) {
    const lastSegmentBuses = segmentBuses[stops.length - 2] || [];
    const lastStopLine = formatStopLine(lastStop.name, lastSegmentBuses);
    lines.push(lastStopLine);
    lines.push('');
  }

  // Summary
  lines.push('-'.repeat(WIDTH));
  lines.push(`Active buses: ${buses.length}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a stop line with bus markers and occupancy info
 * @param {string} stopName - Name of the stop
 * @param {Array} buses - Buses in this segment
 * @returns {string} - Formatted line
 */
function formatStopLine(stopName, buses) {
  const paddedName = stopName.padEnd(STOP_LABEL_WIDTH);
  
  if (buses.length === 0) {
    return  chalk.grey(' ● ' + paddedName);
  }
  
  // Show bus count
  const busCount = buses.length;
  const busIndicator = busCount > 1 ? `[${busCount}x]` : '';
  
  // Get occupancy status from first bus
  const occupancyStatus = buses[0].occupancyStatus || 'UNKNOWN';
  
  // Format: Stop Name  ● 🚍 [count] (occupancy)
  let line =  '🚍 ' + paddedName;
  // let line;
  if (busIndicator) {
    line += ' ' + busIndicator;
  }
  if (occupancyStatus && occupancyStatus !== 'UNKNOWN') {
    line += ` (${occupancyStatus})`;
  }
  
  return line;
}

/**
 * Get unique stops from buses (stops with active buses)
 * @param {Array} buses - Array of bus objects
 * @param {Array} stops - Array of all stops
 * @returns {Array} - Array of stop objects with active buses
 */
export function getStopsWithActiveBuses(buses, stops) {
  const stopIds = new Set();
  
  buses.forEach(bus => {
    const segment = findBusSegment(bus, stops);
    if (segment) {
      stopIds.add(segment.stop1.id);
      stopIds.add(segment.stop2.id);
    }
  });
  
  return stops.filter(stop => stopIds.has(stop.id));
}
