import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePattern } from '../../game/audio/sequencer.js';
import { FINALE_THEME, LUGE_THEME, SKI_JUMP_THEME, SLALOM_THEME, TITLE_THEME } from '../../game/audio/songs.js';

for (const [name, song] of Object.entries({ TITLE_THEME, SKI_JUMP_THEME, SLALOM_THEME, LUGE_THEME, FINALE_THEME })) {
  test(`${name} channels parse and share a whole-bar length`, () => {
    const lengths = song.channels.map((channel) => parsePattern(channel.pattern).length);
    assert.ok(lengths.every((length) => length === lengths[0]), lengths.join(','));
    assert.equal(lengths[0] % 16, 0);
    assert.ok(song.bpm > 0 && song.stepsPerBeat > 0);
  });
}

test('every event has its own theme, different from the others and from the title', async () => {
  const { EVENTS } = await import('../../game/events/registry.js');
  const themes = Object.values(EVENTS).map((event) => event.theme);
  assert.ok(themes.every(Boolean));
  assert.equal(new Set([...themes, TITLE_THEME]).size, themes.length + 1);
  assert.equal(new Set(themes.map((theme) => theme.channels[0].pattern)).size, themes.length);
});
