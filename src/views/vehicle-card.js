import { busMarker, formatOccupancy } from '../utils.js';
import { OCCUPANCY_LEVELS, BAR_TOTAL, COLORS } from '../config.js';

export function occupancyBar(status) {
  if (status === 'NOT_ACCEPTING_PASSENGERS') return `{${COLORS.red}-fg}[×××××]{/${COLORS.red}-fg}`;
  const level = OCCUPANCY_LEVELS.find(l => l.status === status);
  if (!level) return `{${COLORS.inactive}-fg}[·····]{/${COLORS.inactive}-fg}`;
  const filled = '█'.repeat(level.filled) + '·'.repeat(BAR_TOTAL - level.filled);
  return `{${level.color}-fg}[${filled}]{/${level.color}-fg}`;
}

// Format a prediction arrival/departure time as a relative ETA string.
export function fmtEta(isoTime) {
  if (!isoTime) return null;
  const diffMs = new Date(isoTime) - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) return null; // already passed
  if (diffMin === 0) return 'now';
  return `${diffMin}m`;
}

// Return the ETA string for a prediction matching targetStopName, or null.
export function etaForStop(vehiclePreds, targetStopName, lookup) {
  for (const p of vehiclePreds) {
    const s = lookup(p.stopId);
    if (!s || s.name !== targetStopName) continue;
    const time = p.arrivalTime ?? p.departureTime;
    const eta = fmtEta(time);
    if (eta) return eta;
  }
  return null;
}

// Build 1–2 status lines for a vehicle card, using placement indices so stop
// names are always sourced from the route stop list (not child stop IDs).
export function statusLines(bus, placement, stops, lookup, vehiclePreds, INNER) {
  if (!placement) {
    // Unplaced vehicle — best-effort from raw stop lookup
    const s = lookup(bus.currentStopId);
    return [`{${COLORS.inactive}-fg}→ {${COLORS.active}-fg}${s?.name ?? ''}{/${COLORS.active}-fg}{/${COLORS.inactive}-fg}`];
  }

  if (bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT') {
    const currentStop = stops[placement.stopIdx];
    const line1 = `{${COLORS.inactive}-fg}at {${COLORS.active}-fg}${currentStop?.name ?? ''}{/${COLORS.active}-fg}{/${COLORS.inactive}-fg}`;

    // Next: first future prediction for a stop with a different name than current
    const currentName = currentStop?.name ?? '';
    for (const p of vehiclePreds) {
      const s = lookup(p.stopId);
      if (!s || s.name === currentName) continue;
      const time = p.arrivalTime ?? p.departureTime;
      const eta = fmtEta(time);
      if (!eta) continue;
      return [line1, `{${COLORS.inactive}-fg}next: {${COLORS.active}-fg}${s.name}{/${COLORS.active}-fg} in {${COLORS.cyan}-fg}${eta}{/${COLORS.cyan}-fg}{/${COLORS.inactive}-fg}`];
    }
    return [line1];
  }

  // IN_TRANSIT_TO / UNKNOWN — show from → dest with inline ETA
  const destStop = stops[placement.segmentIndex + 1];
  const destName = destStop?.name ?? '';
  const eta = etaForStop(vehiclePreds, destName, lookup);
  const etaSuffix = eta ? ` {${COLORS.cyan}-fg}in ${eta}{/${COLORS.cyan}-fg}` : '';

  const dest = destName.slice(0, INNER - 5);

  const line = `{${COLORS.inactive}-fg}→ {${COLORS.active}-fg}${dest}{/${COLORS.active}-fg}${etaSuffix}{/${COLORS.inactive}-fg}`;
  return [line];
}

export function vehicleStatusLabel(status) {
  switch (status) {
  case 'STOPPED_AT':    return `{${COLORS.yellow}-fg}stopped{/${COLORS.yellow}-fg}`;
  case 'INCOMING_AT':   return `{${COLORS.cyan}-fg}arriving{/${COLORS.cyan}-fg}`;
  case 'IN_TRANSIT_TO': return `{${COLORS.green}-fg}moving{/${COLORS.green}-fg}`;
  default:              return null;
  }
}

export function miniCarIndicatorChar(carriage) {
  if (carriage.occupancyStatus === 'NOT_ACCEPTING_PASSENGERS') {
    return '█';
  }
  if (carriage.occupancyStatus === 'NO_DATA_AVAILABLE') {
    return '·';
  }
  if (carriage.occupancyStatus === 'EMPTY') {
    return ' '; // empty bar - no fill at all
  }
  const level = OCCUPANCY_LEVELS.find(l => l.status === carriage.occupancyStatus);
  // Map 5 levels to 8 quarter-block levels for more granular display
  const quarterLevels = [0, 2, 4, 5, 7, 8]; // indices into quarter-bar chars
  const filled = level
    ? quarterLevels[level.filled]
    : carriage.occupancyPercentage != null
      ? Math.min(8, Math.round(carriage.occupancyPercentage / 12.5))
      : 0;
  const chars = ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  return chars[filled];
}

export function miniCarIndicator(carriage) {
  const char = miniCarIndicatorChar(carriage);
  if (carriage.occupancyStatus === 'NOT_ACCEPTING_PASSENGERS') {
    return `{${COLORS.red}-fg}${char}{/${COLORS.red}-fg}`;
  }
  if (!carriage.occupancyStatus || carriage.occupancyStatus === 'NO_DATA_AVAILABLE') {
    return `{${COLORS.inactive}-fg}${char}{/${COLORS.inactive}-fg}`;
  }
  const level = OCCUPANCY_LEVELS.find(l => l.status === carriage.occupancyStatus);
  const color = level?.color ?? COLORS.inactive;
  return `{${color}-fg}${char}{/${color}-fg}`;
}

// Unified vehicle card renderer for buses and subway/rail vehicles.
// Conditionally adds carriage bar line when bus.carriages.length > 0.
export function renderVehicleCard(bus, placement, colorMap, stops, lookup, vehiclePreds, INNER) {
  const color = colorMap.get(bus.id) || COLORS.active;
  const char = busMarker(bus).char;
  const revenue = bus.revenue ? `{${COLORS.green}-fg}✓{/${COLORS.green}-fg}` : `{${COLORS.red}-fg}✗{/${COLORS.red}-fg}`;
  const label = (bus.label || bus.id).slice(0, 10);
  const speedStr = bus.speed != null ? `{${COLORS.inactive}-fg}${Math.round(bus.speed * 2.23694)}mph{/${COLORS.inactive}-fg}` : null;
  const statusLabel = vehicleStatusLabel(bus.currentStatus);
  const line1Right = [statusLabel, speedStr].filter(Boolean).join(' ');

  const occupancyText = bus.occupancyStatus ? `{${COLORS.inactive}-fg}${formatOccupancy(bus.occupancyStatus)}{/${COLORS.inactive}-fg}` : '';
  const isStopped = bus.currentStatus === 'STOPPED_AT' || bus.currentStatus === 'INCOMING_AT';
  // STOPPED_AT / INCOMING_AT → show the stop being served (stopIdx = destination for INCOMING_AT)
  // IN_TRANSIT_TO / UNKNOWN  → show the stop departed from (segmentIndex)
  const displayName = isStopped
    ? (placement ? stops[placement.stopIdx]?.name : null) ?? lookup(bus.currentStopId)?.name
    : (placement ? stops[placement.segmentIndex]?.name : null);
  const line1Left = displayName
    ? `{${color}-fg}${char} ${displayName}{/${color}-fg} ${revenue}${occupancyText ? ' ' + occupancyText : ''}`
    : `{${color}-fg}${char} #${label}{/${color}-fg} ${revenue}${occupancyText ? ' ' + occupancyText : ''}`;
  const line1 = padBetween(line1Left, line1Right, INNER);

  const sLines = statusLines(bus, placement, stops, lookup, vehiclePreds, INNER);
  // "at [stop]" is now on line 1 — skip it from statusLines output
  const filteredLines = isStopped ? sLines.slice(1) : sLines;

  if (bus.carriages.length > 0) {
    const carIndicators = bus.carriages.map((c, i) => {
      const char = miniCarIndicatorChar(c);
      const indicator = miniCarIndicator(c).replace(/^{[^}]+}-fg}/, '').replace(/}{\/[^}]+}-fg$/, '');
      return `{${COLORS.inactive}-fg}${i + 1}[${indicator}]{/${COLORS.inactive}-fg}`;
    }).join(' ');
    const line2 = carIndicators || `{${COLORS.inactive}-fg}no car data{/${COLORS.inactive}-fg}`;
    return [line1, line2, ...filteredLines];
  }

  return [line1, ...filteredLines];
}

// Lay out left and right text in a fixed-width field.
// Strips blessed tags ({anything}) before measuring visible character width.
export function padBetween(left, right, totalWidth) {
  const visibleLen = s => s.replace(/\{[^}]+\}/g, '').length;
  const gap = Math.max(1, totalWidth - visibleLen(left) - visibleLen(right));
  return left + ' '.repeat(gap) + right;
}
