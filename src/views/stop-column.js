import { busMarker } from '../utils.js';
import { COLORS } from '../config.js';
import { CHARSETS } from '../theme.js';

export function renderColumn(stops, segmentBuses, innerWidth, hasMoreStops = false, colorMap = new Map(), globalOffset = 0, stopEtas = {}) {
  // Cap station name width to prevent overflow; hard cap at 22 chars
  const rawMaxName = Math.max(...stops.map(s => s.name.length), 10);
  const maxNameLength = Math.min(rawMaxName, 22);
  const baseLabelWidth = maxNameLength + 4; // buffer for marker, space, eta
  
  // Calculate track width, enforcing minimum of 20% of pane width
  // Subtract 1 for a safety margin — blessed wraps when content reaches pane width
  const rawTrackWidth = innerWidth - baseLabelWidth - 3 - 1;
  const minTrackWidth = Math.floor(innerWidth * 0.20);
  const trackWidth = Math.max(minTrackWidth, rawTrackWidth);
  
  // Recalculate label width to match actual allocation
  const labelWidth = innerWidth - trackWidth - 3;
  
  const lines = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop?.name) continue;

    const atStop = Object.values(segmentBuses).flat().filter(
      p => p.bus.currentStatus === 'STOPPED_AT' && p.stopIdx === i + globalOffset
    );

    // INCOMING_AT buses: highlight the destination station (stopIdx)
    const approachingAtStation = Object.values(segmentBuses).flat().filter(
      p => p.bus.currentStatus === 'INCOMING_AT' && p.stopIdx === i + globalOffset
    );

    // Show INCOMING_AT progress markers on the track segment (segmentIndex)
    const approachingOnTrack = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'INCOMING_AT'
    );

    const inTransit = (segmentBuses[i] ?? []).filter(
      p => p.bus.currentStatus === 'IN_TRANSIT_TO' || p.bus.currentStatus === 'UNKNOWN'
    );

    const cs = COLORS.asciiMode ? CHARSETS.ascii : CHARSETS.unicode;

    // Build label: name + ETA hint, fitting within labelWidth
    const eta = stopEtas[stop.name];
    const etaStr = eta ? `(${eta})` : '';
    const maxNameLen = etaStr ? labelWidth - etaStr.length - 1 : labelWidth;
    const name = stop.name.length > maxNameLen
      ? stop.name.slice(0, maxNameLen - 1) + cs.ellipsis
      : stop.name;
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
    // Strip tags before padding so blessed-visible width is exact
    const nameVisible = name.replace(/\{[^}]+\}/g, '');
    const padTo = labelWidth - 1 - (etaStr ? etaStr.length + 1 : 0);
    const paddedName = nameVisible.padEnd(Math.max(padTo, nameVisible.length));
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

      trackPart = ' ' + track.map(ch =>
        typeof ch === 'object'
          ? `{${ch.color}-fg}${ch.char}{/${ch.color}-fg}`
          : `{${COLORS.inactive}-fg}${ch}{/${COLORS.inactive}-fg}`
      ).join('');
    }

    lines.push(`${marker} ${nameTag}${trackPart}`);
  }

  return lines;
}
