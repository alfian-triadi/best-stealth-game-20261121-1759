// main.js — Ember Thief's entry point.
//
// Wires the canvas and the HUD to the game, starts the loop, and
// handles the ?shot= query the screenshot harness uses: with it,
// the game stages one fixed scene instead of starting at the title.

import { createGame } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const hud = {
  level: document.getElementById('hud-level'),
  shards: document.getElementById('hud-shards'),
  pebbles: document.getElementById('hud-pebbles'),
  suspicionFill: document.getElementById('hud-suspicion-fill'),
  suspicionLabel: document.getElementById('hud-suspicion-label'),
  timer: document.getElementById('hud-timer'),
  message: document.getElementById('hud-message'),
};

const game = createGame(canvas, hud);
window.__emberGame = game;

// First gesture unlocks audio (browsers require one).
window.addEventListener('pointerdown', () => game.sound.ensureStarted(), { once: true });
window.addEventListener('keydown', () => game.sound.ensureStarted(), { once: true });

// Screenshot staging: ?shot=start|play|alert|win (and &seed=, ignored
// beyond the URL, since the scenes are fixed). The harness calls
// window.__emberStageShot again just before capturing each picture.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
  window.__emberStageShot = (name) => stageShot(game, name);
  window.__emberReady = true;
}
