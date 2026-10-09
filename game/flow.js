import { Competition } from './core/competition.js';
import { describeEventResult } from './core/format.js';
import { ATTEMPTS_PER_EVENT } from './core/rules.js';
import { EVENTS } from './events/registry.js';
import { AudioOptionsScene } from './scenes/audioOptionsScene.js';
import { FinalScene } from './scenes/finalScene.js';
import { InfoScene } from './scenes/infoScene.js';
import { NicknameScene } from './scenes/nicknameScene.js';
import { PauseScene } from './scenes/pauseScene.js';
import { PracticeSelectScene } from './scenes/practiceSelectScene.js';
import { TitleScene } from './scenes/titleScene.js';

export function createFlow(game) {
  const { scenes } = game;

  function toTitle() {
    scenes.replace(new TitleScene({ game, onCompetition: toNickname, onPractice: toPracticeSelect, onOptions: toAudioOptions }));
  }

  function toAudioOptions() {
    scenes.replace(new AudioOptionsScene({ game, onBack: toTitle }));
  }

  function toNickname() {
    scenes.replace(new NicknameScene({ game, onConfirm: startCompetition, onBack: toTitle }));
  }

  function toPracticeSelect() {
    scenes.replace(new PracticeSelectScene({ game, onSelect: startPractice, onBack: toTitle }));
  }

  function startCompetition(nickname) {
    showCompetitionIntro(new Competition(nickname));
  }

  function competitionInfo(options) {
    const info = new InfoScene({ game, ...options });
    info.onPauseQuit = toTitle;
    return info;
  }

  function showCompetitionIntro(competition) {
    const event = EVENTS[competition.currentEventId];
    game.audio.playSong(event.theme);
    scenes.replace(competitionInfo({
      title: event.name,
      lines: [
        `LAJI ${competition.eventIndex + 1}/${competition.eventIds.length}`,
        `PELAAJA ${competition.nickname}`,
        '',
        ...event.instructions,
      ],
      onContinue: () => runCompetitionAttempt(competition),
    }));
  }

  function runCompetitionAttempt(competition) {
    const event = EVENTS[competition.currentEventId];
    const { attemptNumber } = competition;
    const scene = event.createScene({
      game,
      mode: 'competition',
      attemptNumber,
      onComplete: (attempt) => {
        competition.recordAttempt(attempt);
        scenes.replace(competitionInfo({
          title: `YRITYS ${attemptNumber}/${ATTEMPTS_PER_EVENT}`,
          lines: attempt.summary,
          onContinue: () => (competition.isEventComplete()
            ? showEventSummary(competition)
            : runCompetitionAttempt(competition)),
        }));
      },
    });
    scene.onPauseQuit = toTitle;
    scenes.replace(scene);
  }

  function showEventSummary(competition) {
    const eventId = competition.currentEventId;
    const result = competition.eventResult(eventId);
    scenes.replace(competitionInfo({
      title: EVENTS[eventId].name,
      lines: [
        'PARAS SUORITUS',
        describeEventResult(eventId, result),
        `PISTEET ${result.points}`,
        '',
        `KOKONAISPISTEET ${competition.total}`,
      ],
      onContinue: () => {
        competition.advance();
        if (competition.isFinished) toFinal(competition);
        else showCompetitionIntro(competition);
      },
    }));
  }

  function toFinal(competition) {
    scenes.replace(new FinalScene({ game, competition, onDone: toTitle }));
  }

  function startPractice(eventId) {
    const event = EVENTS[eventId];
    game.audio.playSong(event.theme);
    const intro = new InfoScene({
      game,
      title: event.name,
      lines: ['HARJOITTELU', 'ESC = LOPETA', '', ...event.instructions],
      onContinue: () => runPracticeAttempt(eventId, 1),
    });
    intro.onPauseQuit = toPracticeSelect;
    scenes.replace(intro);
  }

  function runPracticeAttempt(eventId, attemptNumber) {
    const scene = EVENTS[eventId].createScene({
      game,
      mode: 'practice',
      attemptNumber,
      onComplete: (attempt) => {
        const result = new InfoScene({
          game,
          title: `HARJOITUS ${attemptNumber}`,
          lines: attempt.summary,
          onContinue: () => runPracticeAttempt(eventId, attemptNumber + 1),
        });
        result.onPauseQuit = toPracticeSelect;
        scenes.replace(result);
      },
    });
    scene.onPauseQuit = toPracticeSelect;
    scenes.replace(scene);
  }

  // Returns true when the key was consumed and the current scene must not update this tick.
  function handleGlobalKeys(input) {
    const paused = scenes.current;
    if (!input.wasPressed('Escape') || !paused?.onPauseQuit) return false;
    scenes.push(new PauseScene({
      game,
      onResume: () => scenes.pop(),
      onQuit: () => paused.onPauseQuit(),
    }));
    return true;
  }

  return { toTitle, handleGlobalKeys };
}
