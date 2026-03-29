import { busMarker } from '../utils.js';

export function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false, colorMap = new Map(), globalOffset = 0, stopEtas = {}) {
  const LABEL_WIDTH = Math.floor(innerWidth / 2) - 2;
  const trackWidth = Math.max(4, innerWidth - LABEL_WIDTH - 3);
  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop?.name) continue;

    const atStop = Object.values(segmentBuses).flat().filter(
      p => (p.bus.currentStatus === 'STOPPED_AT' || p.bus.currentStatus === 'INCOMING_AT')
        && p.stopIdx === i + globalOffset
    );

    const inTransit = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'IN_TRANSIT_TO' || p.bus.currentStatus === 'UNKNOWN'
    );

    // Build label: name + ETA hint, both fitting within LABEL_WIDTH
    const eta = stopEtas[stop.name];
    const etaStr = eta ? `(${eta})` : '';
    const maxNameLen = etaStr ? LABEL_WIDTH - etaStr.length - 1 : LABEL_WIDTH;
    const name = stop.name.length > maxNameLen
      ? stop.name.slice(0, maxNameLen - 1) + '…'
      : stop.name;

    let marker = '{grey-fg}◉{/grey-fg}';
    let nameColor = 'grey';
    if (atStop.length > 0) {
      const p = atStop[0];
      const color = colorMap.get(p.bus.id) || 'white';
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
      nameColor = color;
    } else if (inTransit.length > 0) {
      const p = inTransit[0];
      const color = colorMap.get(p.bus.id) || 'white';
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
      nameColor = color;
    }
    const etaTag = etaStr
      ? (eta === 'now' ? `{cyan-fg}${etaStr}{/cyan-fg}` : `{grey-fg}${etaStr}{/grey-fg}`)
      : '';
    const nameTag = `{${nameColor}-fg}${name.padEnd(LABEL_WIDTH - (etaStr ? etaStr.length + 1 : 0))}{/${nameColor}-fg}${etaStr ? ' ' + etaTag : ''}`;

    let trackPart = '';
    if (!(i === stops.length - 1 && !hasMoreStops)) {
      const track = Array(trackWidth).fill('·');
      track[0] = '╎';

      inTransit.forEach(p => {
        const pos = Math.max(1, Math.min(trackWidth - 2, Math.floor(p.proportion * (trackWidth - 2)) + 1));
        const color = colorMap.get(p.bus.id) || 'white';
        track[pos] = { color, char: busMarker(p.bus).char };
      });

      trackPart = ' ' + track.map(ch =>
        typeof ch === 'object'
          ? `{${ch.color}-fg}${ch.char}{/${ch.color}-fg}`
          : `{grey-fg}${ch}{/grey-fg}`
      ).join('');
    }

    lines.push(`${marker} ${nameTag}${trackPart}`);
  }

  return lines;
}
