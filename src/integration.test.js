import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderVisualization, findBusSegment } from './visualizer.js';
import { calculateDistance } from './utils.js';
import { fetchRoute87Vehicles, fetchRoute87Stops, parseVehicle, parseStop } from './mbta-api.js';

describe('Integration Tests', () => {
  it('should render visualization with empty data', () => {
    const visualization = renderVisualization([], [], 0);
    
    assert.ok(visualization.includes('MBTA Route 87'));
    assert.ok(visualization.includes('No active buses on Route 87'));
  });

  it('should render visualization with buses', () => {
    const buses = [
      {
        id: 'bus1',
        label: '87',
        latitude: 42.3665,
        longitude: -71.0656,
        directionId: 0,
        currentStopSequence: 5,
        lastUpdated: '2024-01-01T12:00:00Z'
      }
    ];

    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: 'Central',
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const visualization = renderVisualization(buses, stops, 0);
    
    assert.ok(visualization.includes('MBTA Route 87'));
    assert.ok(visualization.includes('Lechmere'));
    assert.ok(visualization.includes('Central'));
    assert.ok(visualization.includes('Active buses'));
  });

  it('should find bus segment correctly', () => {
    const bus = {
      latitude: 42.3665,
      longitude: -71.0656
    };

    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: 'Central',
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const segment = findBusSegment(bus, stops);
    
    assert.ok(segment !== null);
    assert.strictEqual(segment.segmentIndex, 0);
    assert.strictEqual(segment.stop1.id, 'stop1');
    assert.strictEqual(segment.stop2.id, 'stop2');
    assert.ok(segment.proportion > 0 && segment.proportion < 1);
  });

  it('should handle bus between stops with correct proportion', () => {
    const bus = {
      latitude: 42.3665,
      longitude: -71.0656
    };

    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: 'Central',
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const segment = findBusSegment(bus, stops);
    
    // Bus is roughly halfway between the two stops
    assert.ok(segment.proportion > 0.4 && segment.proportion < 0.6);
  });

  it('should handle no buses scenario', () => {
    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: 'Central',
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const visualization = renderVisualization([], stops, 0);
    
    assert.ok(visualization.includes('No active buses on Route 87'));
  });

  it('should calculate distance correctly in integration', () => {
    // Lechmere to Central is approximately 900 meters
    const distance = calculateDistance(42.3705, -71.0656, 42.3625, -71.0656);
    
    assert.ok(distance > 800 && distance < 1000, `Expected ~900m, got ${distance}m`);
  });

  it('should handle invalid bus data gracefully', () => {
    const bus = {
      latitude: null,
      longitude: null
    };

    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: 'Central',
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const segment = findBusSegment(bus, stops);
    
    assert.strictEqual(segment, null);
  });

  it('should handle incomplete stop data', () => {
    const stops = [
      {
        id: 'stop1',
        name: 'Lechmere',
        latitude: 42.3705,
        longitude: -71.0656
      },
      {
        id: 'stop2',
        name: null,
        latitude: 42.3625,
        longitude: -71.0656
      }
    ];

    const buses = [
      {
        id: 'bus1',
        label: '87',
        latitude: 42.3665,
        longitude: -71.0656,
        directionId: 0
      }
    ];

    const visualization = renderVisualization(buses, stops, 0);
    
    // Should still render without crashing
    assert.ok(visualization.includes('MBTA Route 87'));
  });

  it('should fetch and process real MBTA Route 87 data', async () => {
    // Skip if running in CI or no network
    if (process.env.CI || !process.env.TEST_REAL_API) {
      return;
    }

    const vehicles = await fetchRoute87Vehicles();
    const stops = await fetchRoute87Stops();

    // Verify we got data
    assert.ok(Array.isArray(vehicles), 'Vehicles should be an array');
    assert.ok(Array.isArray(stops), 'Stops should be an array');

    // Parse and validate vehicle data
    const parsedVehicles = vehicles
      .map(parseVehicle)
      .filter(v => v !== null);

    // Validate stop data
    const parsedStops = stops
      .map(parseStop)
      .filter(s => s !== null);

    assert.ok(parsedStops.length > 0, 'Should have at least one stop');

    // If there are vehicles, verify they can be rendered
    if (parsedVehicles.length > 0) {
      const visualization = renderVisualization(parsedVehicles, parsedStops, 0);
      assert.ok(visualization.includes('MBTA Route 87'), 'Should include route header');
      assert.ok(visualization.includes('Active buses'), 'Should include bus count');
    }
  });
});
