import { PlaceholderEventScene } from './placeholderEvent.js';

function placeholder(id, name) {
  return (options) => new PlaceholderEventScene({ ...options, eventId: id, name });
}

export const EVENTS = {
  skiJump: {
    id: 'skiJump',
    name: 'MÄKIHYPPY',
    instructions: ['VÄLILYÖNTI = LÄHTÖ, PONNISTUS', 'JA ALASTULO', 'NUOLET = LENTOASENTO'],
    createScene: placeholder('skiJump', 'MÄKIHYPPY'),
  },
  slalom: {
    id: 'slalom',
    name: 'PUJOTTELU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA VAUHTI', 'NUOLET = KÄÄNTYMINEN'],
    createScene: placeholder('slalom', 'PUJOTTELU'),
  },
  luge: {
    id: 'luge',
    name: 'OHJASKELKKAILU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA TYÖNTÖ', 'NUOLET = OHJAUS', 'NUOLI ALAS = JARRU'],
    createScene: placeholder('luge', 'OHJASKELKKAILU'),
  },
};
