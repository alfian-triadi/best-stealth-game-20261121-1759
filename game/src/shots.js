// shots.js — deterministic states for the screenshots.
//
// The screenshot harness loads the game with ?shot=<name> and calls
// stageShot right before capturing, so each picture shows the game
// at its best: the title, a quiet stalk, a full alarm, and the win.
// Nothing here is reachable in normal play; it only stages a scene.

import { TILE_SIZE } from './levels.js';

/** Put the thief at a tile centre. */
function placeThief(state, col, row) {
  state.player.x = col * TILE_SIZE + TILE_SIZE / 2;
  state.player.y = row * TILE_SIZE + TILE_SIZE / 2;
}

/** Put a guard at a tile centre, facing an angle, in a state. */
function placeGuard(state, index, col, row, facing, guardState, suspicion, investigateAt) {
  const guard = state.guards[index];
  if (!guard) return;
  guard.x = col * TILE_SIZE + TILE_SIZE / 2;
  guard.y = row * TILE_SIZE + TILE_SIZE / 2;
  guard.facing = facing;
  guard.state = guardState;
  guard.suspicion = suspicion;
  guard.pauseLeft = 0;
  if (investigateAt) guard.investigateAt = investigateAt;
}

/**
 * Stage one screenshot scene on a live game. Called once at load
 * and again just before each capture, so the scene is exactly as
 * staged however long the page has been open.
 */
export function stageShot(game, name) {
  const state = game.state;
  if (name === 'start') {
    game.loadLevel(0);
    state.screen = 'title';
    state.levelTime = 0;
    state.totalTime = 0;
    return;
  }
  if (name === 'win') {
    game.loadLevel(2);
    state.screen = 'win';
    state.levelTime = 187;
    state.totalTime = 342;
    state.totalShards = 13;
    for (const shard of state.shards) shard.taken = true;
    state.exitOpen = true;
    return;
  }

  // 'play' and 'alert' both stage level 1 mid-game.
  game.loadLevel(0);
  state.screen = 'playing';
  state.levelTime = 34;

  if (name === 'play') {
    // The thief crouched in a bush, a warden's cone sweeping past,
    // one ember already stolen: the quiet heart of the game.
    placeThief(state, 7, 2);
    state.player.facing = 0.4;
    state.player.sneaking = true;
    placeGuard(state, 0, 17, 2, Math.PI, 'patrol', 12);
    placeGuard(state, 1, 10, 10, -Math.PI / 2, 'patrol', 0);
    state.shards[0].taken = true;
    state.totalShards = 1;
    return;
  }

  if (name === 'alert') {
    // Full alarm: a warden charging the thief, who is two steps from
    // the moon gate with every ember stolen. The chase starts far
    // enough away that the capture happens after the screenshot.
    for (const shard of state.shards) shard.taken = true;
    state.totalShards = 3;
    state.exitOpen = true;
    placeThief(state, 21, 12);
    state.player.facing = Math.PI / 4;
    placeGuard(state, 0, 19, 10, Math.PI / 4, 'chase', 100);
    placeGuard(state, 1, 10, 8, Math.PI / 2, 'investigate', 62, {
      x: 21 * TILE_SIZE + TILE_SIZE / 2,
      y: 12 * TILE_SIZE + TILE_SIZE / 2,
    });
    state.ripples.push({ x: 20 * TILE_SIZE, y: 11 * TILE_SIZE, age: 0.3, life: 0.9 });
  }
}
