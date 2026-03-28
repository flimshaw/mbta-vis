import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateDistance, calculatePositionProportion, formatDistance, formatTime } from './utils.js';

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

describe('formatDistance', () => {
  it('should format small distances in meters', () => {
    assert.strictEqual(formatDistance(100), '100 m');
    assert.strictEqual(formatDistance(500), '500 m');
  });

  it('should format large distances in kilometers', () => {
    assert.strictEqual(formatDistance(1500), '1.5 km');
    assert.strictEqual(formatDistance(2000), '2.0 km');
  });
});

describe('formatTime', () => {
  it('should return "Unknown" for null/undefined', () => {
    assert.strictEqual(formatTime(null), 'Unknown');
    assert.strictEqual(formatTime(undefined), 'Unknown');
  });

  it('should show relative time for recent timestamps', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 10000); // 10 seconds ago
    const result = formatTime(recent.toISOString());
    assert.ok(result === 'Just now' || result.includes('m ago'));
  });

  it('should show HH:MM for older timestamps', () => {
    const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const result = formatTime(oldTime.toISOString());
    assert.ok(result !== 'Unknown' && result !== 'Just now');
  });
});
