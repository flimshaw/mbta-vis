import { busMarker } from '../utils.js';
import { COLORS } from '../config.js';
import { CHARSETS } from '../theme.js';

export function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false, colorMap = new Map(), globalOffset = 0, stopEtas = {}) {
  const FIXED_LABEL_WIDTH = 30; // name + eta always totals this many visible chars
  const cs = COLORS.asciiMode ? CHARSETS.ascii : CHARSETS.unicode;

  // Track width: innerWidth minus label(20) minus marker(1) minus space(1) minus 1 safety margin
  const rawTrackWidth = innerWidth - FIXED_LABEL_WIDTH - 3;
  const minTrackWidth = Math.floor(innerWidth * 0.20);
  const trackWidth = Math.max(minTrackWidth, rawTrackWidth);

  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop?.name) continue;

    const atStop = Object.values(segmentBuses).flat().filter(
      p => p.bus.currentStatus === 'STOPPED_AT' && p.stopIdx === i + globalOffset
    );

    const approachingAtStation = Object.values(segmentBuses).flat().filter(
      p => p.bus.currentStatus === 'INCOMING_AT' && p.stopIdx === i + globalOffset
    );

    const approachingOnTrack = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'INCOMING_AT'
    );

    const inTransit = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'IN_TRANSIT_TO' || p.bus.currentStatus === 'UNKNOWN'
    );

    // Build name: the label (name + eta) is always exactly FIXED_LABEL_WIDTH visible chars.
    // When there's an ETA, the name is shortened to make room.
    const eta = stopEtas[stop.name];
    const etaStr = eta ? `(${eta})` : '';
    const nameLen = etaStr ? FIXED_LABEL_WIDTH - 1 - etaStr.length : FIXED_LABEL_WIDTH;
    const name = stop.name.length > nameLen
      ? stop.name.slice(0, Math.max(nameLen - 3, 0)) + '.. '
      : stop.name;
    const paddedName = name.padEnd(nameLen);

    let marker = `{${COLORS.inactive}-fg}${cs.stopMarker}{/${COLORS.inactive}-fg}`;
    let nameColor = COLORS.inactive;
    if (atStop.length > 0) {
      const p = atStop[0];
      const color = colorMap.get(p.bus.id) || COLORS.active;
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
      nameColor = color;
    } else if (approachingAtStation.length > 0) {
      const p = approachingAtStation[0];
      const color = colorMap.get(p.bus.id) || COLORS.active;
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
      nameColor = color;
    } else if (inTransit.length > 0) {
      const p = inTransit[0];
      const color = colorMap.get(p.bus.id) || COLORS.active;
      marker = `{${color}-fg}${busMarker(p.bus).char}{/${color}-fg}`;
      nameColor = color;
    }
    const etaTag = etaStr
      ? (eta === 'now' ? `{${COLORS.cyan}-fg}${etaStr}{/${COLORS.cyan}-fg}` : `{${COLORS.inactive}-fg}${etaStr}{/${COLORS.inactive}-fg}`)
      : '';
    // paddedName is exactly nameLen chars; with eta the total label is FIXED_LABEL_WIDTH
    const nameTag = `{${nameColor}-fg}${paddedName}{/${nameColor}-fg}${etaStr ? ' ' + etaTag : ''}`;

    let trackPart = '';
    if (!(i === stops.length - 1 && !hasMoreStops)) {
      const track = Array(trackWidth).fill(cs.trackDot);
      track[0] = cs.trackEdge;

      // Show approaching buses on the track segment (they are INCOMING_AT the next stop)
      // Their progress is shown on segmentIndex, while their destination station is highlighted
      approachingOnTrack.forEach(p => {
        const pos = Math.max(1, Math.min(trackWidth - 2, Math.floor(p.proportion * (trackWidth - 2)) + 1));
        const color = colorMap.get(p.bus.id) || COLORS.active;
        track[pos] = { color, char: busMarker(p.bus).char };
      });

      // Show in-transit buses on this segment
      inTransit.forEach(p => {
        const pos = Math.max(1, Math.min(trackWidth - 2, Math.floor(p.proportion * (trackWidth - 2)) + 1));
        const color = colorMap.get(p.bus.id) || COLORS.active;
        track[pos] = { color, char: busMarker(p.bus).char };
      });

      trackPart = track.map(ch =>
        typeof ch === 'object'
          ? `{${ch.color}-fg}${ch.char}{/${ch.color}-fg}`
          : `{${COLORS.inactive}-fg}${ch}{/${COLORS.inactive}-fg}`
      ).join('');
    }

    lines.push(`${marker} ${nameTag}${trackPart}`);
  }

  return lines;
}
