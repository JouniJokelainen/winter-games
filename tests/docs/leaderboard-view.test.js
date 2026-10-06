import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatMetric, renderLeaderboard } from '../../docs/leaderboard-view.js';

const BOARD = {
  version: 1,
  users: {},
  top: [{ nickname: 'JOUNI', total: 150 }, { nickname: 'AKU', total: 120 }],
  eventRecords: {
    skiJump: { nickname: 'JOUNI', points: 76, distance: 198.5, date: '2026-10-06T12:00:00.000Z' },
    luge: { nickname: 'AKU', points: 60, time: 29.87, date: '2026-10-06T12:00:00.000Z' },
  },
  recent: [{
    nickname: 'JOUNI',
    date: '2026-10-06T12:00:00.000Z',
    total: 150,
    events: { skiJump: { points: 76, distance: 198.5 }, slalom: { points: 30, time: 35.2 }, luge: { points: 44, time: 33.1 } },
  }],
};

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml('<b>"A" & \'B\'</b>'), '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
});

test('formatMetric formats distance and time with Finnish decimals', () => {
  assert.equal(formatMetric('skiJump', 198.5), '198,5 m');
  assert.equal(formatMetric('slalom', 29.871), '29,87 s');
  assert.equal(formatMetric('luge', null), '-');
});

test('formatDate gives d.m.yyyy', () => {
  assert.equal(formatDate('2026-10-06T12:00:00.000Z'), '6.10.2026');
});

test('renderLeaderboard lists top totals in order', () => {
  const html = renderLeaderboard(BOARD);
  assert.ok(html.indexOf('JOUNI') < html.indexOf('AKU'));
  assert.match(html, /150/);
});

test('renderLeaderboard shows event records and a dash for missing ones', () => {
  const html = renderLeaderboard(BOARD);
  assert.match(html, /MÄKIHYPPY[\s\S]*JOUNI[\s\S]*198,5 m/);
  assert.match(html, /PUJOTTELU<\/td><td>-<\/td>/);
});

test('renderLeaderboard shows an empty message when there are no results', () => {
  const html = renderLeaderboard({ version: 1, users: {}, top: [], eventRecords: {}, recent: [] });
  assert.match(html, /EI VIELÄ TULOKSIA/);
});

test('renderLeaderboard escapes nicknames', () => {
  const html = renderLeaderboard({ ...BOARD, top: [{ nickname: '<X>', total: 1 }] });
  assert.ok(!html.includes('<X>'));
});

test('renderLeaderboard escapes numeric totals in top rankings', () => {
  const html = renderLeaderboard({ version: 1, users: {}, top: [{ nickname: 'JOUNI', total: '<b>' }], eventRecords: {}, recent: [] });
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(!html.includes('<b>'));
});

test('renderLeaderboard handles recent entry with missing events', () => {
  const board = {
    version: 1,
    users: {},
    top: [],
    eventRecords: {},
    recent: [{ nickname: 'JOUNI', date: '2026-10-06T12:00:00.000Z', total: 150 }],
  };
  const html = renderLeaderboard(board);
  assert.match(html, /VIIMEISIMMÄT KILPAILUT/);
  assert.ok(html.includes('-'));
});

test('renderLeaderboard handles recent entry with missing event', () => {
  const board = {
    version: 1,
    users: {},
    top: [],
    eventRecords: {},
    recent: [{
      nickname: 'JOUNI',
      date: '2026-10-06T12:00:00.000Z',
      total: 150,
      events: { skiJump: { points: 76 }, slalom: { points: 30 } },
    }],
  };
  const html = renderLeaderboard(board);
  assert.match(html, /VIIMEISIMMÄT KILPAILUT/);
  assert.ok(html.includes('-'));
});

test('renderLeaderboard escapes nickname in eventRecords', () => {
  const board = {
    version: 1,
    users: {},
    top: [],
    eventRecords: { skiJump: { nickname: '<X>', points: 76, distance: 198.5 } },
    recent: [],
  };
  const html = renderLeaderboard(board);
  assert.ok(html.includes('&lt;X&gt;'));
  assert.ok(!html.includes('<X>'));
});

test('renderLeaderboard escapes points in eventRecords', () => {
  const board = {
    version: 1,
    users: {},
    top: [],
    eventRecords: { skiJump: { nickname: 'JOUNI', points: '<b>', distance: 198.5 } },
    recent: [],
  };
  const html = renderLeaderboard(board);
  assert.ok(html.includes('&lt;b&gt;'));
});
