import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOLUTION_SCALE } from '../../game/engine/constants.js';
import { SceneManager } from '../../game/engine/sceneManager.js';

function scene(name, log) {
  return {
    enter: () => log.push(`enter ${name}`),
    exit: () => log.push(`exit ${name}`),
    update: () => log.push(`update ${name}`),
    render: () => log.push(`render ${name}`),
  };
}

test('replace exits all scenes and enters the new one', () => {
  const log = [];
  const manager = new SceneManager();
  manager.push(scene('a', log));
  manager.push(scene('b', log));
  manager.replace(scene('c', log));
  assert.deepEqual(log, ['enter a', 'enter b', 'exit b', 'exit a', 'enter c']);
});

test('only the top scene updates, all scenes render bottom-up', () => {
  const log = [];
  const manager = new SceneManager();
  manager.push(scene('a', log));
  manager.push(scene('b', log));
  log.length = 0;
  manager.update(1 / 60, {});
  manager.render({});
  assert.deepEqual(log, ['update b', 'render a', 'render b']);
});

test('pop removes the top scene and exits it', () => {
  const log = [];
  const manager = new SceneManager();
  const a = scene('a', log);
  manager.push(a);
  manager.push(scene('b', log));
  manager.pop();
  assert.equal(manager.current, a);
  assert.equal(log.at(-1), 'exit b');
});

test('scenes without enter/exit hooks are fine', () => {
  const manager = new SceneManager();
  manager.replace({ update() {}, render() {} });
  manager.pop();
  assert.equal(manager.current, null);
});

test('render scales low-resolution scenes and draws high-resolution scenes 1:1', () => {
  const transforms = [];
  const ctx = { setTransform: (...args) => transforms.push(args) };
  const manager = new SceneManager();
  manager.push({ update() {}, render() {} });
  manager.push({ highResolution: true, update() {}, render() {} });
  manager.render(ctx);
  assert.deepEqual(transforms, [[RESOLUTION_SCALE, 0, 0, RESOLUTION_SCALE, 0, 0], [1, 0, 0, 1, 0, 0]]);
});
