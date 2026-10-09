import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdOf, staleRedirect } from '../../game/core/updateCheck.js';

const answer = (body, status = 200) => async () => ({ ok: status === 200, status, json: async () => body });

test('buildIdOf reads the build id from a stamped module address', () => {
  assert.equal(buildIdOf('https://x.test/peli/main.js?v=abc123'), 'abc123');
  assert.equal(buildIdOf('http://127.0.0.1:8080/main.js'), null);
});

test('a current or unstamped build does not reload', async () => {
  assert.equal(await staleRedirect({ ownId: 'abc', pathname: '/peli/', fetchFn: answer({ id: 'abc' }) }), null);
  assert.equal(await staleRedirect({ ownId: null, pathname: '/peli/', fetchFn: () => assert.fail('no fetch for local play') }), null);
});

test('a stale build reloads through an address with the new id', async () => {
  assert.equal(await staleRedirect({ ownId: 'old', pathname: '/winter-games/peli/', fetchFn: answer({ id: 'new1' }) }), '/winter-games/peli/?v=new1');
});

test('the reload is not repeated when the new address is already open', async () => {
  const fetchFn = answer({ id: 'new1' });
  assert.equal(await staleRedirect({ ownId: 'old', pathname: '/peli/', search: '?v=new1', fetchFn }), null);
  assert.equal(await staleRedirect({ ownId: 'old', pathname: '/peli/', search: '?v=other', fetchFn }), '/peli/?v=new1');
});

test('a missing, broken or slow version file never blocks the game', async () => {
  const base = { ownId: 'old', pathname: '/peli/' };
  assert.equal(await staleRedirect({ ...base, fetchFn: answer({}, 404) }), null);
  assert.equal(await staleRedirect({ ...base, fetchFn: answer({ id: 7 }) }), null);
  assert.equal(await staleRedirect({ ...base, fetchFn: answer({ id: '' }) }), null);
  assert.equal(await staleRedirect({ ...base, fetchFn: async () => { throw new TypeError('offline'); } }), null);
  assert.equal(await staleRedirect({ ...base, fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('html'); } }) }), null);
  assert.equal(await staleRedirect({ ...base, fetchFn: () => new Promise(() => {}), timeoutMs: 20 }), null);
});
