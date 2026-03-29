import { describe, it } from 'node:test';
import assert from 'node:assert';
import { groupPredictions, resolveUnknownStopIds, cacheKey } from './route-data.js';

describe('groupPredictions', () => {
  it('should group predictions by vehicleId', () => {
    const raw = [
      { vehicleId: 'v1', stopId: 's1', stopSequence: 2 },
      { vehicleId: 'v2', stopId: 's2', stopSequence: 1 },
      { vehicleId: 'v1', stopId: 's3', stopSequence: 1 },
    ];

    const result = groupPredictions(raw);

    assert.deepStrictEqual(Object.keys(result).sort(), ['v1', 'v2']);
    assert.strictEqual(result.v1.length, 2);
    assert.strictEqual(result.v2.length, 1);
  });

  it('should sort each group by stopSequence ascending', () => {
    const raw = [
      { vehicleId: 'v1', stopId: 's3', stopSequence: 3 },
      { vehicleId: 'v1', stopId: 's1', stopSequence: 1 },
      { vehicleId: 'v1', stopId: 's2', stopSequence: 2 },
    ];

    const result = groupPredictions(raw);

    assert.deepStrictEqual(result.v1.map(p => p.stopId), ['s1', 's2', 's3']);
  });

  it('should treat missing stopSequence as 0', () => {
    const raw = [
      { vehicleId: 'v1', stopId: 'sB', stopSequence: 1 },
      { vehicleId: 'v1', stopId: 'sA' },
    ];

    const result = groupPredictions(raw);
    assert.strictEqual(result.v1[0].stopId, 'sA');
  });

  it('should return empty object for empty input', () => {
    assert.deepStrictEqual(groupPredictions([]), {});
  });
});

describe('resolveUnknownStopIds', () => {
  const routeStops = [
    { id: 'place-central' },
    { id: 'place-harvard' },
  ];

  it('should return stop IDs not in the route stop list', () => {
    const buses = [{ currentStopId: 'place-central-1' }]; // child stop
    const preds = [{ stopId: 'place-harvard-2' }];

    const result = resolveUnknownStopIds(buses, preds, routeStops);

    assert.deepStrictEqual(result.sort(), ['place-central-1', 'place-harvard-2']);
  });

  it('should exclude stop IDs already in the route list', () => {
    const buses = [{ currentStopId: 'place-central' }];
    const preds = [{ stopId: 'place-harvard' }];

    const result = resolveUnknownStopIds(buses, preds, routeStops);

    assert.deepStrictEqual(result, []);
  });

  it('should deduplicate IDs appearing in both buses and predictions', () => {
    const buses = [{ currentStopId: 'child-1' }];
    const preds = [{ stopId: 'child-1' }];

    const result = resolveUnknownStopIds(buses, preds, routeStops);

    assert.deepStrictEqual(result, ['child-1']);
  });

  it('should filter out null and undefined stop IDs', () => {
    const buses = [{ currentStopId: null }, { currentStopId: undefined }];
    const preds = [{ stopId: null }];

    const result = resolveUnknownStopIds(buses, preds, routeStops);

    assert.deepStrictEqual(result, []);
  });

  it('should return empty array when all stops are known', () => {
    const buses = [{ currentStopId: 'place-central' }];
    const preds = [];

    assert.deepStrictEqual(resolveUnknownStopIds(buses, preds, routeStops), []);
  });
});

describe('cacheKey', () => {
  it('should combine route and direction', () => {
    assert.strictEqual(cacheKey('87', 0), '87:0');
    assert.strictEqual(cacheKey('87', 1), '87:1');
    assert.strictEqual(cacheKey('Red', 0), 'Red:0');
  });

  it('should produce distinct keys for different routes or directions', () => {
    assert.notStrictEqual(cacheKey('87', 0), cacheKey('77', 0));
    assert.notStrictEqual(cacheKey('87', 0), cacheKey('87', 1));
  });
});
