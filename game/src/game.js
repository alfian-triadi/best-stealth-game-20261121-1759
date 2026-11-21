// game.js — Ember Thief's state machine and main loop.
//
// Screens: title → playing → (caught | levelComplete) → playing …
// → win. The loop updates the thief and the wardens, turns noise
// into investigations, opens the moon gate once every shard is
// stolen, and keeps the HUD (level, shards, pebbles, suspicion,
// timer, message) in step with the game.

import { LEVELS, parseLevel } from './levels.js';
import { createPlayer, updatePlayer, isOnTile } from './player.js';
import {
  createGuard,
  updateGuard,
  guardHearNoise,
  HEARING_RANGE,
  PEBBLE_HEARING_RANGE,
} from './guard.js';
import { drawGame } from './render.js';
import { createInput } from './input.js';
import { createSoundEngine } from './audio.js';
import { makeSeededRandom, distance } from './utils.js';

/** Seconds a HUD message stays up before the hint returns. */
const MESSAGE_SECONDS = 3.5;
/** Pixels a guard walks between audible footsteps. */
const GUARD_STEP_LENGTH = 34;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Build the game on a canvas, with the HUD elements beside it. */
export function createGame(canvas, hud) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const sound = createSoundEngine();

  const state = {
    screen: 'title',
    levelIndex: 0,
    level: null,
    grid: null,
    player: null,
    guards: [],
    shards: [],
    lanterns: [],
    exit: null,
    exitOpen: false,
    gateAnnounced: false,
    ripples: [],
    fireflies: [],
    levelTime: 0,
    totalTime: 0,
    totalShards: 0,
    message: '',
    messageLeft: 0,
    time: 0,
    running: true,
  };

  function showMessage(text) {
    state.message = text;
    state.messageLeft = MESSAGE_SECONDS;
    hud.message.textContent = text;
  }

  function showHint() {
    hud.message.textContent = state.level
      ? state.level.def.subtitle
      : 'Press Enter to begin';
  }

  /** Decorative fireflies, seeded per level so they never wander. */
  function makeFireflies() {
    const rng = makeSeededRandom(1000 + state.levelIndex * 77);
    const flies = [];
    let tries = 0;
    while (flies.length < 14 && tries < 300) {
      tries++;
      const col = Math.floor(rng() * 24);
      const row = Math.floor(rng() * 16);
      const ch = state.grid[row][col];
      if (ch === '#' || ch === 'C') continue;
      flies.push({
        x: col * 40 + 8 + rng() * 24,
        y: row * 40 + 8 + rng() * 24,
        speed: 0.4 + rng() * 0.8,
        phase: rng() * Math.PI * 2,
      });
    }
    return flies;
  }

  /** Load a level fresh: new thief, new wardens, un-stolen shards. */
  function loadLevel(index) {
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    state.levelIndex = index;
    state.level = parsed;
    state.grid = parsed.grid;
    state.shards = parsed.shards;
    state.lanterns = parsed.lanterns;
    state.exit = parsed.exit;
    state.exitOpen = false;
    state.gateAnnounced = false;
    state.player = createPlayer(parsed.start);
    state.player.pebbles = def.pebbles;
    state.guards = def.guards.map((g, i) => createGuard(g, i));
    state.ripples = [];
    state.fireflies = makeFireflies();
    state.levelTime = 0;
    state.screen = 'playing';
    hud.level.textContent = `Level ${index + 1} — ${def.name}`;
    showHint();
  }

  function startGame() {
    state.totalTime = 0;
    state.totalShards = 0;
    loadLevel(0);
  }

  /** The highest suspicion among the wardens, for the HUD meter. */
  function maxSuspicion() {
    let max = 0;
    for (const guard of state.guards) max = Math.max(max, guard.suspicion);
    return max;
  }

  function refreshHud() {
    const taken = state.shards.filter((s) => s.taken).length;
    hud.shards.textContent = `Embers ${taken}/${state.shards.length}`;
    hud.pebbles.textContent = `Pebbles ${state.player ? state.player.pebbles : 0}`;
    hud.timer.textContent = formatTime(state.levelTime);
    const suspicion = maxSuspicion();
    hud.suspicionFill.style.width = `${suspicion}%`;
    hud.suspicionFill.style.background =
      suspicion >= 100 ? '#ff4d4d' : suspicion >= 34 ? '#ffb020' : '#7ddb8a';
    hud.suspicionLabel.textContent =
      suspicion >= 100 ? 'SPOTTED!' : suspicion >= 34 ? 'Suspicious…' : 'Unseen';
    if (state.messageLeft > 0) {
      state.messageLeft -= 1 / 60;
      if (state.messageLeft <= 0) showHint();
    }
  }

  /** Turn a guard's footstep distance into an audible footstep. */
  function guardFootsteps(dt) {
    for (const guard of state.guards) {
      const before = guard.stepDistance;
      if (before >= GUARD_STEP_LENGTH) {
        guard.stepDistance -= GUARD_STEP_LENGTH;
        sound.guardFootstep(distance(guard.x, guard.y, state.player.x, state.player.y));
      }
    }
  }

  function handlePlayerEvents(events) {
    for (const event of events) {
      if (event.type === 'step') {
        sound.footstep(event.loudness);
        if (event.heard) {
          // Walking is heard: nearby wardens come to look.
          for (const guard of state.guards) {
            const dist = distance(guard.x, guard.y, state.player.x, state.player.y);
            if (dist < HEARING_RANGE) {
              guardHearNoise(guard, state.player.x, state.player.y);
            }
          }
        }
      } else if (event.type === 'pebble') {
        sound.pebble();
        state.ripples.push({ x: event.x, y: event.y, age: 0, life: 0.9 });
        for (const guard of state.guards) {
          const dist = distance(guard.x, guard.y, event.x, event.y);
          if (dist < PEBBLE_HEARING_RANGE) {
            guardHearNoise(guard, event.x, event.y);
          }
        }
        showMessage('Pebble thrown — the wardens heard it.');
      }
    }
  }

  function handleGuardEvents(events) {
    for (const event of events) {
      if (event.type === 'spotted') {
        sound.alarm();
        showMessage('Spotted! Break line of sight!');
      } else if (event.type === 'suspicious') {
        sound.suspicious();
        showMessage('A warden thinks it saw something…');
      } else if (event.type === 'lost') {
        showMessage('You lost them. Breathe. Keep moving.');
      } else if (event.type === 'caught') {
        state.player.alive = false;
        state.screen = 'caught';
        sound.caught();
      }
    }
  }

  function updatePlaying(dt) {
    state.levelTime += dt;
    state.totalTime += dt;
    const playerEvents = updatePlayer(state.player, state.grid, input, dt);
    handlePlayerEvents(playerEvents);

    const guardEvents = [];
    for (const guard of state.guards) {
      updateGuard(guard, state.grid, state.player, state.lanterns, dt, guardEvents);
    }
    guardFootsteps(dt);
    handleGuardEvents(guardEvents);
    if (state.screen !== 'playing') return;

    // Pick up ember shards by walking over them.
    for (const shard of state.shards) {
      if (!shard.taken && distance(state.player.x, state.player.y, shard.x, shard.y) < 24) {
        shard.taken = true;
        state.totalShards += 1;
        sound.pickup();
        const taken = state.shards.filter((s) => s.taken).length;
        showMessage(`Ember ${taken}/${state.shards.length} stolen.`);
        if (taken === state.shards.length) {
          state.exitOpen = true;
          sound.gateOpen();
          showMessage('All embers stolen — the moon gate is open!');
        }
      }
    }

    // Reach the open moon gate to clear the level.
    if (state.exitOpen && isOnTile(state.player, state.exit)) {
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.screen = 'win';
        sound.win();
      } else {
        state.screen = 'levelComplete';
      }
    }

    for (const ripple of state.ripples) ripple.age += dt;
    state.ripples = state.ripples.filter((r) => r.age < r.life);
  }

  function update(dt) {
    state.time += dt;
    if (input.wasPressed('KeyM')) {
      const muted = sound.toggleMute();
      showMessage(muted ? 'Sound off.' : 'Sound on.');
    }
    if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter')) {
      sound.ensureStarted();
      if (state.screen === 'title') startGame();
      else if (state.screen === 'levelComplete') loadLevel(state.levelIndex + 1);
    }
    if (input.wasPressed('KeyR')) {
      if (state.screen === 'caught') loadLevel(state.levelIndex);
      else if (state.screen === 'win') startGame();
    }
    if (state.screen === 'playing') updatePlaying(dt);
    input.endFrame();
  }

  function frame(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - frame.last) / 1000 || 0.016);
    frame.last = now;
    update(dt);
    refreshHud();
    drawGame(ctx, {
      grid: state.grid ?? parseLevel(LEVELS[0]).grid,
      level: state.level,
      levelNumber: state.levelIndex + 1,
      levelName: state.level ? state.level.def.name : LEVELS[0].name,
      player: state.player ?? createPlayer(parseLevel(LEVELS[0]).start),
      guards: state.guards,
      shards: state.shards,
      lanterns: state.lanterns,
      exit: state.exit ?? parseLevel(LEVELS[0]).exit,
      exitOpen: state.exitOpen,
      ripples: state.ripples,
      fireflies: state.fireflies,
      screen: state.screen,
      levelTimeText: formatTime(state.levelTime),
      parText: formatTime(state.level ? state.level.def.parSeconds : 90),
      totalTimeText: formatTime(state.totalTime),
      totalShards: state.totalShards,
    }, state.time);
    requestAnimationFrame(frame);
  }
  frame.last = 0;

  // First paint: the title screen over level 1, so the game looks
  // complete before the player ever presses Enter.
  loadLevel(0);
  state.screen = 'title';
  state.levelTime = 0;
  state.totalTime = 0;
  requestAnimationFrame(frame);

  return {
    state,
    sound,
    loadLevel,
    startGame,
    /** Stop the loop (used by the screenshot harness). */
    stop() {
      state.running = false;
    },
  };
}
