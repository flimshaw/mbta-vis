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
