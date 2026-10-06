const EVENTS = [
  ['skiJump', 'MÄKIHYPPY'],
  ['slalom', 'PUJOTTELU'],
  ['luge', 'OHJASKELKKAILU'],
];
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function formatMetric(eventId, value) {
  if (value === null || value === undefined) return '-';
  return eventId === 'skiJump'
    ? `${value.toFixed(1).replace('.', ',')} m`
    : `${value.toFixed(2).replace('.', ',')} s`;
}

export function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function metricOf(eventId, entry) {
  return eventId === 'skiJump' ? entry.distance : entry.time;
}

function renderTop(top) {
  if (top.length === 0) return '<p class="empty">EI VIELÄ TULOKSIA</p>';
  const rows = top.map((entry, index) => (
    `<tr><td class="rank">${index + 1}.</td><td>${escapeHtml(entry.nickname)}</td><td class="num">${escapeHtml(entry.total)}</td></tr>`
  ));
  return `<table class="top">${rows.join('')}</table>`;
}

function renderRecords(records) {
  const rows = EVENTS.map(([eventId, name]) => {
    const record = records[eventId];
    if (!record) return `<tr><td>${name}</td><td>-</td><td></td><td></td></tr>`;
    return `<tr><td>${name}</td><td>${escapeHtml(record.nickname)}</td>`
      + `<td class="num">${formatMetric(eventId, metricOf(eventId, record))}</td>`
      + `<td class="num">${escapeHtml(record.points)} p</td></tr>`;
  });
  return `<table>${rows.join('')}</table>`;
}

function renderRecent(recent) {
  if (recent.length === 0) return '<p class="empty">EI VIELÄ KILPAILUJA</p>';
  const header = '<tr><th>PVM</th><th>PELAAJA</th><th>MÄKI</th><th>PUJO</th><th>KELKKA</th><th>YHT</th></tr>';
  const rows = recent.map((entry) => (
    `<tr><td>${formatDate(entry.date)}</td><td>${escapeHtml(entry.nickname)}</td>`
    + EVENTS.map(([eventId]) => `<td class="num">${entry.events?.[eventId]?.points ?? '-'}</td>`).join('')
    + `<td class="num">${escapeHtml(entry.total)}</td></tr>`
  ));
  return `<table>${header}${rows.join('')}</table>`;
}

export function renderLeaderboard(board) {
  return [
    `<section><h2>PARHAAT YHTEISPISTEET</h2>${renderTop(board.top ?? [])}</section>`,
    `<section><h2>LAJIENNÄTYKSET</h2>${renderRecords(board.eventRecords ?? {})}</section>`,
    `<section><h2>VIIMEISIMMÄT KILPAILUT</h2>${renderRecent(board.recent ?? [])}</section>`,
  ].join('');
}
