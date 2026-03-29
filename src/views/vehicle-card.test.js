import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fmtEta, padBetween, occupancyBar, etaForStop } from './vehicle-card.js';

describe('fmtEta', () => {
  it('should return null for falsy input', () => {
    assert.strictEqual(fmtEta(null), null);
    assert.strictEqual(fmtEta(undefined), null);
    assert.strictEqual(fmtEta(''), null);
  });

  it('should return null for a time in the past', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.strictEqual(fmtEta(past), null);
  });

  it('should return "now" for a time within the current minute', () => {
    const soon = new Date(Date.now() + 20 * 1000).toISOString();
    assert.strictEqual(fmtEta(soon), 'now');
  });

  it('should return minutes string for future times', () => {
    const future = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    assert.strictEqual(fmtEta(future), '3m');
  });
});

describe('padBetween', () => {
  it('should pad plain text to totalWidth', () => {
    const result = padBetween('left', 'right', 20);
    assert.strictEqual(result.replace(/\{[^}]+\}/g, '').length, 20);
    assert.ok(result.startsWith('left'));
    assert.ok(result.endsWith('right'));
  });

  it('should strip blessed tags when measuring width', () => {
    const left = '{cyan-fg}left{/cyan-fg}';
    const right = '{grey-fg}right{/grey-fg}';
    // Visible: "left" (4) + gap + "right" (5) = totalWidth
    const result = padBetween(left, right, 15);
    const visibleLen = result.replace(/\{[^}]+\}/g, '').length;
    assert.strictEqual(visibleLen, 15);
  });

  it('should use at least 1 space gap even when text fills the width', () => {
    const result = padBetween('lefttexthere', 'right', 5); // longer than width
    assert.ok(result.includes(' ')); // at least one space
  });
});

describe('occupancyBar', () => {
  it('should return red X bar for NOT_ACCEPTING_PASSENGERS', () => {
    assert.strictEqual(occupancyBar('NOT_ACCEPTING_PASSENGERS'), '{red-fg}[×××××]{/red-fg}');
  });

  it('should return grey empty bar for unknown status', () => {
    assert.strictEqual(occupancyBar('UNKNOWN_STATUS'), '{grey-fg}[·····]{/grey-fg}');
    assert.strictEqual(occupancyBar(null), '{grey-fg}[·····]{/grey-fg}');
  });

  it('should return empty green bar for EMPTY', () => {
    assert.strictEqual(occupancyBar('EMPTY'), '{green-fg}[·····]{/green-fg}');
  });

  it('should return full red bar for FULL', () => {
    assert.strictEqual(occupancyBar('FULL'), '{red-fg}[█████]{/red-fg}');
  });

  it('should return partially filled bar for intermediate levels', () => {
    const bar = occupancyBar('FEW_SEATS_AVAILABLE');
    assert.ok(bar.includes('██'), 'should have 2 filled blocks');
    assert.ok(bar.includes('yellow'), 'should be yellow');
  });
});

describe('etaForStop', () => {
  const stops = [
    { id: 's1', name: 'Central' },
    { id: 's2', name: 'Harvard' },
  ];
  const lookup = (id) => stops.find(s => s.id === id);

  it('should return ETA when a prediction matches the stop name', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const preds = [{ stopId: 's1', arrivalTime: futureTime }];
    assert.strictEqual(etaForStop(preds, 'Central', lookup), '5m');
  });

  it('should use departureTime when arrivalTime is absent', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const preds = [{ stopId: 's2', departureTime: futureTime }];
    assert.strictEqual(etaForStop(preds, 'Harvard', lookup), '2m');
  });

  it('should return null when no prediction matches the stop name', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const preds = [{ stopId: 's1', arrivalTime: futureTime }];
    assert.strictEqual(etaForStop(preds, 'Harvard', lookup), null);
  });

  it('should return null when the matching prediction time is in the past', () => {
    const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const preds = [{ stopId: 's1', arrivalTime: pastTime }];
    assert.strictEqual(etaForStop(preds, 'Central', lookup), null);
  });

  it('should return null for empty predictions', () => {
    assert.strictEqual(etaForStop([], 'Central', lookup), null);
  });
});
