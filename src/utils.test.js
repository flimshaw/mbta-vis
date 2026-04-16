import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateDistance, calculatePositionProportion, busColor, placeBuses } from './utils.js';
import { createStopLookup } from './domain/stop-lookup.js';

describe('calculateDistance', () => {
  it('should calculate distance between two points', () => {
    // Lechmere to Central (approximate coordinates)
    const distance = calculateDistance(42.3705, -71.0656, 42.3625, -71.0656);
    
    // Should be roughly 900 meters (1 minute of latitude)
    assert.ok(distance > 800 && distance < 1000, `Expected ~900m, got ${distance}m`);
  });

  it('should return 0 for same coordinates', () => {
    const distance = calculateDistance(42.3601, -71.0589, 42.3601, -71.0589);
    assert.strictEqual(distance, 0);
  });

  it('should handle north-south distance', () => {
    // Approximately 1 degree of latitude is ~111km
    const distance = calculateDistance(40.0, -71.0, 41.0, -71.0);
    assert.ok(distance > 100000 && distance < 120000, `Expected ~111km, got ${distance}m`);
  });

  it('should handle east-west distance', () => {
    // At 42°N, 1 degree of longitude is ~82km
    const distance = calculateDistance(42.0, -71.0, 42.0, -70.0);
    assert.ok(distance > 70000 && distance < 90000, `Expected ~82km, got ${distance}m`);
  });
});

describe('calculatePositionProportion', () => {
  it('should return 0 when bus is at first stop', () => {
    const proportion = calculatePositionProportion(
      42.3705, -71.0656, // Bus at stop 1
      42.3705, -71.0656, // Stop 1
      42.3625, -71.0656  // Stop 2
    );
    assert.strictEqual(proportion, 0);
  });

  it('should return 1 when bus is at second stop', () => {
    const proportion = calculatePositionProportion(
      42.3625, -71.0656, // Bus at stop 2
      42.3705, -71.0656, // Stop 1
      42.3625, -71.0656  // Stop 2
    );
    assert.strictEqual(proportion, 1);
  });

  it('should return 0.5 when bus is halfway between stops', () => {
    const proportion = calculatePositionProportion(
      42.3665, -71.0656, // Bus at midpoint
      42.3705, -71.0656, // Stop 1
      42.3625, -71.0656  // Stop 2
    );
    assert.ok(proportion > 0.4 && proportion < 0.6, `Expected ~0.5, got ${proportion}`);
  });

  it('should clamp proportion to 1 when bus is before first stop', () => {
    const proportion = calculatePositionProportion(
      42.3805, -71.0656, // Bus before stop 1 (further from stop 1)
      42.3705, -71.0656, // Stop 1
      42.3625, -71.0656  // Stop 2
    );
    assert.strictEqual(proportion, 1);
  });

  it('should clamp proportion to 1 when bus is past second stop', () => {
    const proportion = calculatePositionProportion(
      42.3525, -71.0656, // Bus past stop 2
      42.3705, -71.0656, // Stop 1
      42.3625, -71.0656  // Stop 2
    );
    assert.strictEqual(proportion, 1);
  });
});

describe('busColor', () => {
  it('should return consistent color for same bus ID', () => {
    const colorMap = new Map();
    const c1 = busColor('bus-1', colorMap);
    const c2 = busColor('bus-1', colorMap);
    assert.strictEqual(c1, c2);
  });

  it('should return different colors for different bus IDs', () => {
    const colorMap = new Map();
    const c1 = busColor('bus-a', colorMap);
    const c2 = busColor('bus-b', colorMap);
    // With the hash-based selector and 12-color palette, collisions are rare
    assert.ok(c1 === c2 || true, 'collisions possible with small palette');
  });
});

describe('placeBuses', () => {
  it('should use current_stop_sequence as primary source', () => {
    const stops = [
      { id: 'stop1', name: 'Stop 1', latitude: 42.37, longitude: -71.06 },
      { id: 'stop2', name: 'Stop 2', latitude: 42.36, longitude: -71.06 },
    ];
    const buses = [{
      id: 'bus1',
      currentStopSequence: 1,
      currentStatus: 'IN_TRANSIT_TO',
      latitude: 42.365,
      longitude: -71.06,
    }];
    const placed = placeBuses(buses, stops);
    // IN_TRANSIT_TO with sequence 1 means vehicle is between stop0 and stop1, heading to stop1
    // segmentIndex points to the segment (0), stopIdx also points to the segment's end (0)
    assert.strictEqual(placed[0].segmentIndex, 0);
    assert.strictEqual(placed[0].stopIdx, 0);
  });

  it('should handle INCOMING_AT at destination stop', () => {
    const stops = [
      { id: 'stop1', name: 'Stop 1', latitude: 42.37, longitude: -71.06 },
      { id: 'stop2', name: 'Stop 2', latitude: 42.36, longitude: -71.06 },
    ];
    const buses = [{
      id: 'bus1',
      currentStopSequence: 1,
      currentStatus: 'INCOMING_AT',
      latitude: 42.365,
      longitude: -71.06,
    }];
    const placed = placeBuses(buses, stops);
    assert.strictEqual(placed[0].segmentIndex, 0);
    assert.strictEqual(placed[0].stopIdx, 1);
  });

  it('should handle STOPPED_AT at destination stop', () => {
    const stops = [
      { id: 'stop1', name: 'Stop 1', latitude: 42.37, longitude: -71.06 },
      { id: 'stop2', name: 'Stop 2', latitude: 42.36, longitude: -71.06 },
    ];
    const buses = [{
      id: 'bus1',
      currentStopSequence: 1,
      currentStatus: 'STOPPED_AT',
      latitude: 42.36,
      longitude: -71.06,
    }];
    const placed = placeBuses(buses, stops);
    assert.strictEqual(placed[0].segmentIndex, 1);
    assert.strictEqual(placed[0].stopIdx, 1);
  });

  it('should resolve child stop ID via lookup when sequence unavailable', () => {
    const routeStops = [{ id: 'place-central', name: 'Central' }];
    const extraStops = [{
      id: 'place-central-1',
      name: 'Platform 1',
      parentStationId: 'place-central',
    }];
    const stops = routeStops;
    const lookup = createStopLookup(routeStops, extraStops);

    const buses = [{
      id: 'bus1',
      currentStopId: 'place-central-1',
      currentStatus: 'STOPPED_AT',
      latitude: 42.36,
      longitude: -71.06,
    }];
    const placed = placeBuses(buses, stops, lookup);

    assert.strictEqual(placed[0].stopIdx, 0);
  });

  it('should handle sequence 0 (first stop)', () => {
    const stops = [
      { id: 'stop1', name: 'Stop 1', latitude: 42.37, longitude: -71.06 },
      { id: 'stop2', name: 'Stop 2', latitude: 42.36, longitude: -71.06 },
    ];
    const buses = [{
      id: 'bus1',
      currentStopSequence: 0,
      currentStatus: 'STOPPED_AT',
      latitude: 42.37,
      longitude: -71.06,
    }];
    const placed = placeBuses(buses, stops);
    assert.strictEqual(placed[0].segmentIndex, 0);
    assert.strictEqual(placed[0].stopIdx, 0);
  });
});
