import { PlaceholderEventScene } from './placeholderEvent.js';
import { SkiJumpScene } from './skiJump/skiJumpScene.js';
import { SlalomScene } from './slalom/slalomScene.js';

function placeholder(id, name) {
  return (options) => new PlaceholderEventScene({ ...options, eventId: id, name });
}

export const EVENTS = {
  skiJump: {
    id: 'skiJump',
    name: 'MÄKIHYPPY',
    instructions: ['VÄLILYÖNTI = LÄHTÖ, PONNISTUS', 'JA ALASTULO', 'NUOLET = LENTOASENTO'],
    createScene: (options) => new SkiJumpScene(options),
  },
  slalom: {
    id: 'slalom',
    name: 'PUJOTTELU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA VAUHTI', 'NUOLET = KÄÄNTYMINEN', 'KIERRÄ KEPIT ULKOPUOLELTA'],
    createScene: (options) => new SlalomScene(options),
  },
  luge: {
    id: 'luge',
    name: 'OHJASKELKKAILU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA TYÖNTÖ', 'NUOLET = OHJAUS', 'NUOLI ALAS = JARRU'],
    createScene: placeholder('luge', 'OHJASKELKKAILU'),
  },
};
