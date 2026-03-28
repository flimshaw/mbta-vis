import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseVehicle, parseStop } from './mbta-api.js';

describe('parseVehicle', () => {
  it('should parse valid vehicle data', () => {
    const vehicle = {
      id: 'veh_123',
      attributes: {
        label: '87',
        latitude: 42.3601,
        longitude: -71.0589,
        direction_id: 0,
        current_stop_sequence: 5,
        last_update: '2024-01-01T12:00:00Z'
      }
    };

    const result = parseVehicle(vehicle);

    assert.deepStrictEqual(result, {
      id: 'veh_123',
      label: '87',
      latitude: 42.3601,
      longitude: -71.0589,
      directionId: 0,
      currentStopSequence: 5,
      lastUpdated: '2024-01-01T12:00:00Z'
    });
  });

  it('should use default label 87 when label is missing', () => {
    const vehicle = {
      id: 'veh_456',
      attributes: {
        latitude: 42.3601,
        longitude: -71.0589,
        direction_id: 1
      }
    };

    const result = parseVehicle(vehicle);

    assert.strictEqual(result.label, '87');
  });

  it('should return null for invalid vehicle (no attributes)', () => {
    const vehicle = {
      id: 'veh_789'
    };

    const result = parseVehicle(vehicle);

    assert.strictEqual(result, null);
  });

  it('should return null for null input', () => {
    const result = parseVehicle(null);

    assert.strictEqual(result, null);
  });
});

describe('parseStop', () => {
  it('should parse valid stop data', () => {
    const stop = {
      id: 'stop_123',
      attributes: {
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656,
        stop_id: 'lechmere'
      }
    };

    const result = parseStop(stop);

    assert.deepStrictEqual(result, {
      id: 'stop_123',
      name: 'Lechmere',
      latitude: 42.3705,
      longitude: -71.0656,
      stopId: 'lechmere'
    });
  });

  it('should use default name when name is missing', () => {
    const stop = {
      id: 'stop_456',
      attributes: {
        latitude: 42.3601,
        longitude: -71.0589,
        stop_id: 'central'
      }
    };

    const result = parseStop(stop);

    assert.strictEqual(result.name, 'Stop stop_456');
  });

  it('should return null for invalid stop (no attributes)', () => {
    const stop = {
      id: 'stop_789'
    };

    const result = parseStop(stop);

    assert.strictEqual(result, null);
  });

  it('should return null for null input', () => {
    const result = parseStop(null);

    assert.strictEqual(result, null);
  });
});
