/**
 * Calculate the haversine distance between two coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the proportion of distance along a segment
 * @param {number} busLat - Bus latitude
 * @param {number} busLon - Bus longitude
 * @param {number} stop1Lat - First stop latitude
 * @param {number} stop1Lon - First stop longitude
 * @param {number} stop2Lat - Second stop latitude
 * @param {number} stop2Lon - Second stop longitude
 * @returns {number} - Proportion between 0 and 1
 */
export function calculatePositionProportion(busLat, busLon, stop1Lat, stop1Lon, stop2Lat, stop2Lon) {
  const totalDistance = calculateDistance(stop1Lat, stop1Lon, stop2Lat, stop2Lon);
  
  if (totalDistance === 0) {
    return 0;
  }
  
  const busToStop1 = calculateDistance(busLat, busLon, stop1Lat, stop1Lon);
  const proportion = busToStop1 / totalDistance;
  
  // Clamp between 0 and 1
  // 0 = at stop 1, 1 = at stop 2
  return Math.max(0, Math.min(1, proportion));
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} - Formatted distance string
 */
export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Find which segment a bus belongs to (closest segment by distance)
 * @param {object} bus - Parsed bus object with latitude/longitude
 * @param {Array} stops - Array of parsed stop objects
 * @returns {object|null} - { segmentIndex, proportion, stop1, stop2 } or null
 */
export function findBusSegment(bus, stops) {
  if (!bus?.latitude || !bus?.longitude || !stops || stops.length < 2) return null;

  let bestSegment = null;
  let bestDist = Infinity;

  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];
    if (!stop1?.latitude || !stop2?.latitude) continue;

    const d1 = calculateDistance(bus.latitude, bus.longitude, stop1.latitude, stop1.longitude);
    const d2 = calculateDistance(bus.latitude, bus.longitude, stop2.latitude, stop2.longitude);

    if (Math.min(d1, d2) < bestDist) {
      bestDist = Math.min(d1, d2);
      bestSegment = {
        segmentIndex: i,
        stop1,
        stop2,
        proportion: calculatePositionProportion(
          bus.latitude, bus.longitude,
          stop1.latitude, stop1.longitude,
          stop2.latitude, stop2.longitude
        ),
      };
    }
  }

  return bestSegment;
}

/**
 * Place all buses onto their segments, returning clean placement objects.
 * Avoids mutating bus objects.
 * @param {Array} buses - Parsed bus objects
 * @param {Array} stops - Parsed stop objects
 * @returns {Array} - [{ bus, segmentIndex, proportion, stopIdx }]
 */
export function placeBuses(buses, stops) {
  return buses.flatMap(bus => {
    // Prefer stop-ID-based placement: the API tells us exactly which stop the
    // vehicle is at or heading to, which is far more reliable than GPS nearest-segment.
    const destIdx = stops.findIndex(s => s.id === bus.currentStopId);

    if (destIdx >= 0) {
      if (bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT') {
        return [{ bus, segmentIndex: destIdx, proportion: 0, stopIdx: destIdx }];
      }
      // IN_TRANSIT_TO / UNKNOWN: vehicle is between destIdx-1 and destIdx
      if (destIdx > 0) {
        const stop1 = stops[destIdx - 1];
        const stop2 = stops[destIdx];
        const proportion = (stop1?.latitude && stop2?.latitude && bus.latitude != null)
          ? calculatePositionProportion(
              bus.latitude, bus.longitude,
              stop1.latitude, stop1.longitude,
              stop2.latitude, stop2.longitude,
            )
          : 0.5;
        return [{ bus, segmentIndex: destIdx - 1, proportion, stopIdx: destIdx - 1 }];
      }
    }

    // Fallback: currentStopId is a child stop not in the route list — use GPS.
    const seg = findBusSegment(bus, stops);
    if (!seg) return [];
    const { segmentIndex, proportion } = seg;
    const stopIdx =
      bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT'
        ? (proportion > 0.5 ? segmentIndex + 1 : segmentIndex)
        : segmentIndex;
    return [{ bus, segmentIndex, proportion, stopIdx }];
  });
}

// Palette of distinct colors for per-bus identity coloring.
// Hex values for brightness and variety on dark terminals.
// Avoid red (reserved for errors) and grey (inactive stops).
const BUS_PALETTE = [
  '#4dabf7', // sky blue
  '#69db7c', // green
  '#ffd43b', // yellow
  '#da77f2', // violet
  '#ff922b', // orange
  '#38d9a9', // teal
  '#f783ac', // pink
  '#a9e34b', // lime
  '#74c0fc', // light blue
  '#e599f7', // lavender
  '#63e6be', // mint
  '#ffa8a8', // salmon
];

/**
 * Assign a stable color to a bus ID from the palette.
 * Pass the same colorMap across renders to keep colors stable.
 * @param {string} busId
 * @param {Map} colorMap - Persistent Map<busId, color>
 * @returns {string} blessed color name
 */
export function busColor(busId, colorMap) {
  if (!colorMap.has(busId)) {
    colorMap.set(busId, BUS_PALETTE[colorMap.size % BUS_PALETTE.length]);
  }
  return colorMap.get(busId);
}

/**
 * Get display marker character for a bus based on its status.
 * Color is now sourced from busColor() rather than status.
 * @param {object} bus - Parsed bus object
 * @returns {{ char: string }}
 */
export function busMarker(bus) {
  switch (bus.currentStatus) {
    case 'STOPPED_AT':    return { char: '■' };
    case 'INCOMING_AT':   return { char: '▷' };
    case 'IN_TRANSIT_TO': return { char: '▶' };
    default:              return { char: '▶' };
  }
}

/**
 * Format occupancy status into a short human-readable string.
 * @param {string} status
 * @returns {string}
 */
export function formatOccupancy(status) {
  switch (status) {
    case 'EMPTY':                       return 'Empty';
    case 'MANY_SEATS_AVAILABLE':        return 'Many seats';
    case 'FEW_SEATS_AVAILABLE':         return 'Few seats';
    case 'STANDING_ROOM_ONLY':          return 'Standing only';
    case 'CRUSHED_STANDING_ROOM_ONLY':  return 'Crushed';
    case 'FULL':                        return 'Full';
    case 'NOT_ACCEPTING_PASSENGERS':    return 'Not boarding';
    default:                            return 'Unknown';
  }
}

/**
 * Format time for display
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} - Formatted time string
 */
export function formatTime(isoString) {
  if (!isoString) return 'Unknown';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  
  // If within 5 minutes, show "Just now"
  if (diffMs < 5 * 60 * 1000) {
    return 'Just now';
  }
  
  // If within 1 hour, show minutes ago
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  // Otherwise show HH:MM
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
