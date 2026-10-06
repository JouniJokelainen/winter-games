import { METRIC_KEY } from './rules.js';

export const LANDING_LABEL = { perfect: 'TÄYDELLINEN', poor: 'HUONO', fall: 'KAATUMINEN' };

export function formatTime(seconds) {
  return `${seconds.toFixed(2).replace('.', ',')} S`;
}

export function formatDistance(metres) {
  return `${metres.toFixed(1).replace('.', ',')} M`;
}

export function describeEventResult(eventId, result) {
  const value = result[METRIC_KEY[eventId]];
  if (eventId === 'skiJump') return value === null ? 'EI ONNISTUNUTTA HYPPYÄ' : `PITUUS ${formatDistance(value)}`;
  return value === null ? 'EI HYVÄKSYTTYÄ LASKUA' : `AIKA ${formatTime(value)}`;
}
