import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Menu, visibleWindow } from '../../game/ui/menu.js';
import { fakeInput } from '../helpers/fakeInput.js';

const items = () => [{ label: 'A', value: 1 }, { label: 'B', value: 2 }, { label: () => 'C', value: 3 }];

test('arrow keys move the selection with wrap-around and notify', () => {
  let moves = 0;
  const menu = new Menu(items(), { onMove: () => { moves += 1; } });
  assert.equal(menu.update(fakeInput(['ArrowDown'])), null);
  assert.equal(menu.index, 1);
  menu.update(fakeInput(['ArrowUp']));
  menu.update(fakeInput(['ArrowUp']));
  assert.equal(menu.index, 2);
  menu.update(fakeInput(['ArrowDown']));
  assert.equal(menu.index, 0);
  assert.equal(moves, 4);
});

test('space or enter returns the selected item', () => {
  const menu = new Menu(items());
  menu.update(fakeInput(['ArrowDown']));
  assert.equal(menu.update(fakeInput(['Space'])).value, 2);
  assert.equal(menu.update(fakeInput(['Enter'])).value, 2);
  assert.equal(menu.update(fakeInput([])), null);
});

test('visibleWindow keeps the selection inside the visible range', () => {
  assert.deepEqual(visibleWindow(5, 0, 8), [0, 5]);
  assert.deepEqual(visibleWindow(20, 0, 8), [0, 8]);
  assert.deepEqual(visibleWindow(20, 10, 8), [6, 14]);
  assert.deepEqual(visibleWindow(20, 19, 8), [12, 20]);
});
