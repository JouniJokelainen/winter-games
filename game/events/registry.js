import { LUGE_THEME, SKI_JUMP_THEME, SLALOM_THEME } from '../audio/songs.js';
import { LugeScene } from './luge/lugeScene.js';
import { SkiJumpScene } from './skiJump/skiJumpScene.js';
import { SlalomScene } from './slalom/slalomScene.js';

export const EVENTS = {
  skiJump: {
    id: 'skiJump',
    name: 'MÄKIHYPPY',
    instructions: ['VÄLILYÖNTI = LÄHTÖ, PONNISTUS', 'JA ALASTULO', 'NUOLET = LENTOASENTO'],
    theme: SKI_JUMP_THEME,
    createScene: (options) => new SkiJumpScene(options),
  },
  slalom: {
    id: 'slalom',
    name: 'PUJOTTELU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA VAUHTI', 'NUOLET = KÄÄNTYMINEN', 'KIERRÄ KEPIT ULKOPUOLELTA'],
    theme: SLALOM_THEME,
    createScene: (options) => new SlalomScene(options),
  },
  luge: {
    id: 'luge',
    name: 'OHJASKELKKAILU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA TYÖNTÖ', 'NUOLET = OHJAUS', 'NUOLI ALAS = JARRU'],
    theme: LUGE_THEME,
    createScene: (options) => new LugeScene(options),
  },
};
