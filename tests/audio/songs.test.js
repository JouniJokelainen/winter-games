import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePattern } from '../../game/audio/sequencer.js';
import { EVENT_THEME, TITLE_THEME } from '../../game/audio/songs.js';

for (const [name, song] of Object.entries({ TITLE_THEME, EVENT_THEME })) {
  test(`${name} channels parse and share a whole-bar length`, () => {
    const lengths = song.channels.map((channel) => parsePattern(channel.pattern).length);
    assert.ok(lengths.every((length) => length === lengths[0]), lengths.join(','));
    assert.equal(lengths[0] % 16, 0);
    assert.ok(song.bpm > 0 && song.stepsPerBeat > 0);
  });
}
