import { test } from 'node:test';
import assert from 'node:assert/strict';
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
