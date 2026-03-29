import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseVehicle, parseStop } from './mbta-api.js';

describe('parseVehicle', () => {
  it('should parse a complete vehicle', () => {
    const raw = {
      id: 'veh_123',
      attributes: {
        label: '4201',
        latitude: 42.3601,
        longitude: -71.0589,
        direction_id: 0,
        current_stop_sequence: 5,
        updated_at: '2024-01-01T12:00:00Z',
        occupancy_status: 'MANY_SEATS_AVAILABLE',
        current_status: 'IN_TRANSIT_TO',
        speed: 10.5,
        revenue: 'REVENUE',
        carriages: [],
      },
      relationships: { stop: { data: { id: 'place-central' } } },
    };

    const result = parseVehicle(raw);

    assert.deepStrictEqual(result, {
      id: 'veh_123',
      label: '4201',
      latitude: 42.3601,
      longitude: -71.0589,
      directionId: 0,
      currentStopSequence: 5,
      currentStopId: 'place-central',
      lastUpdated: '2024-01-01T12:00:00Z',
      occupancyStatus: 'MANY_SEATS_AVAILABLE',
      currentStatus: 'IN_TRANSIT_TO',
      speed: 10.5,
      revenue: true,
      carriages: [],
    });
  });

  it('should fall back to vehicle id when label is missing', () => {
    const raw = {
      id: 'veh_456',
      attributes: { latitude: 42.3601, longitude: -71.0589, direction_id: 1 },
    };
    assert.strictEqual(parseVehicle(raw).label, 'veh_456');
  });

  it('should default currentStatus to UNKNOWN when absent', () => {
    const raw = {
      id: 'veh_789',
      attributes: { latitude: 42.3601, longitude: -71.0589 },
    };
    assert.strictEqual(parseVehicle(raw).currentStatus, 'UNKNOWN');
  });

  it('should set revenue false for NON_REVENUE vehicles', () => {
    const raw = {
      id: 'veh_000',
      attributes: { latitude: 42.3601, longitude: -71.0589, revenue: 'NON_REVENUE' },
    };
    assert.strictEqual(parseVehicle(raw).revenue, false);
  });

  it('should parse carriage occupancy data', () => {
    const raw = {
      id: 'veh_train',
      attributes: {
        latitude: 42.3601,
        longitude: -71.0589,
        carriages: [
          { label: '1', occupancy_status: 'MANY_SEATS_AVAILABLE', occupancy_percentage: 20 },
          { label: '2', occupancy_status: 'FULL', occupancy_percentage: 100 },
        ],
      },
    };
    const result = parseVehicle(raw);
    assert.strictEqual(result.carriages.length, 2);
    assert.deepStrictEqual(result.carriages[0], { label: '1', occupancyStatus: 'MANY_SEATS_AVAILABLE', occupancyPercentage: 20 });
    assert.deepStrictEqual(result.carriages[1], { label: '2', occupancyStatus: 'FULL', occupancyPercentage: 100 });
  });

  it('should set currentStopId null when relationship is absent', () => {
    const raw = {
      id: 'veh_nostop',
      attributes: { latitude: 42.3601, longitude: -71.0589 },
    };
    assert.strictEqual(parseVehicle(raw).currentStopId, null);
  });

  it('should return null for missing attributes', () => {
    assert.strictEqual(parseVehicle({ id: 'veh_bad' }), null);
  });

  it('should return null for null input', () => {
    assert.strictEqual(parseVehicle(null), null);
  });
});

describe('parseStop', () => {
  it('should parse a complete stop', () => {
    const raw = {
      id: 'place-central',
      attributes: {
        name: 'Central',
        platform_name: 'Outbound',
        latitude: 42.3625,
        longitude: -71.0656,
      },
    };

    assert.deepStrictEqual(parseStop(raw), {
      id: 'place-central',
      name: 'Central',
      platformName: 'Outbound',
      latitude: 42.3625,
      longitude: -71.0656,
    });
  });

  it('should default name to "Stop <id>" when name is missing', () => {
    const raw = {
      id: 'stop_456',
      attributes: { latitude: 42.3601, longitude: -71.0589 },
    };
    assert.strictEqual(parseStop(raw).name, 'Stop stop_456');
  });

  it('should set platformName null when absent', () => {
    const raw = {
      id: 'stop_789',
      attributes: { name: 'Harvard', latitude: 42.3, longitude: -71.1 },
    };
    assert.strictEqual(parseStop(raw).platformName, null);
  });

  it('should return null for missing attributes', () => {
    assert.strictEqual(parseStop({ id: 'stop_bad' }), null);
  });

  it('should return null for null input', () => {
    assert.strictEqual(parseStop(null), null);
  });
});
