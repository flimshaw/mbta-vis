import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createStopLookup } from './stop-lookup.js';

const routeStops = [
  { id: 'place-central', name: 'Central' },
  { id: 'place-harvard', name: 'Harvard' },
];

const extraStops = [
  { id: 'place-central-1', name: 'Central (Platform 1)' },
];

describe('createStopLookup', () => {
  it('should find a stop in the route list', () => {
    const lookup = createStopLookup(routeStops, []);
    assert.deepStrictEqual(lookup('place-central'), { id: 'place-central', name: 'Central' });
  });

  it('should fall back to extra stops when not in route list', () => {
    const lookup = createStopLookup(routeStops, extraStops);
    assert.deepStrictEqual(lookup('place-central-1'), { id: 'place-central-1', name: 'Central (Platform 1)' });
  });

  it('should prefer route stop over extra stop when id appears in both', () => {
    const extra = [{ id: 'place-central', name: 'Central (extra)' }];
    const lookup = createStopLookup(routeStops, extra);
    assert.strictEqual(lookup('place-central').name, 'Central');
  });

  it('should return undefined for an unknown id', () => {
    const lookup = createStopLookup(routeStops, extraStops);
    assert.strictEqual(lookup('place-unknown'), undefined);
  });

  it('should handle empty route and extra stop lists', () => {
    const lookup = createStopLookup([], []);
    assert.strictEqual(lookup('place-central'), undefined);
  });

  it('should resolve child stop to parent route stop', () => {
    const routeStops = [{ id: 'place-central', name: 'Central' }];
    const extraStops = [
      { id: 'place-central-1', name: 'Platform 1', parentStationId: 'place-central' },
    ];
    const lookup = createStopLookup(routeStops, extraStops);
    const result = lookup.resolveToRouteStop('place-central-1');
    assert.deepStrictEqual(result, { id: 'place-central', name: 'Central' });
  });

  it('should handle multi-level parent chain', () => {
    const routeStops = [{ id: 'place-central', name: 'Central' }];
    const extraStops = [
      { id: 'place-central-1', name: 'Platform 1', parentStationId: 'place-central-2' },
      { id: 'place-central-2', name: 'Mezzanine', parentStationId: 'place-central' },
    ];
    const lookup = createStopLookup(routeStops, extraStops);
    const result = lookup.resolveToRouteStop('place-central-1');
    assert.deepStrictEqual(result, { id: 'place-central', name: 'Central' });
  });

  it('should return null when parent chain does not reach route stop', () => {
    const routeStops = [{ id: 'place-central', name: 'Central' }];
    const extraStops = [
      { id: 'place-central-1', name: 'Platform 1', parentStationId: 'place-unknown' },
    ];
    const lookup = createStopLookup(routeStops, extraStops);
    const result = lookup.resolveToRouteStop('place-central-1');
    assert.strictEqual(result, null);
  });

  it('should return null when stop has no parentStationId', () => {
    const routeStops = [{ id: 'place-central', name: 'Central' }];
    const extraStops = [
      { id: 'place-central-1', name: 'Platform 1' }, // no parentStationId
    ];
    const lookup = createStopLookup(routeStops, extraStops);
    const result = lookup.resolveToRouteStop('place-central-1');
    assert.strictEqual(result, null);
  });
});
