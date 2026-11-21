// player.js — Pip, the ember thief.
//
// Movement is grid-collision based: the thief is a circle that
// slides along walls. Walking is fast but loud; sneaking (Shift) is
// slow and quiet. Standing in a moonbloom bush hides the thief from
// guards unless one is almost on top of them. A mouse click throws
// a pebble that clinks where it lands and pulls guards over to look.

import { clamp, distance } from './utils.js';
import { TILE_SIZE, isSolidAt, tileAt, isCoverTile } from './levels.js';
import { HEARING_RANGE } from './guard.js';

/** Walking speed in pixels per second. */
export const WALK_SPEED = 150;
/** Sneaking speed in pixels per second. */
export const SNEAK_SPEED = 82;
/** Distance between footsteps, in pixels. */
export const STEP_LENGTH = 30;
/** The thief's collision radius, in pixels. */
export const PLAYER_RADIUS = 13;

/** Build the thief at a level's start tile. */
export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    alive: true,
    sneaking: false,
    moving: false,
    inBush: false,
    stepDistance: 0,
    pebbles: 0,
  };
}

/** Try to move the thief by (dx, dy), sliding along solid tiles. */
function moveWithCollision(player, grid, dx, dy) {
  const r = PLAYER_RADIUS;
  const nx = player.x + dx;
  if (
    !isSolidAt(grid, nx + Math.sign(dx) * r, player.y - r + 2) &&
    !isSolidAt(grid, nx + Math.sign(dx) * r, player.y + r - 2) &&
    !isSolidAt(grid, nx + Math.sign(dx) * r, player.y)
  ) {
    player.x = nx;
  }
  const ny = player.y + dy;
  if (
    !isSolidAt(grid, player.x - r + 2, ny + Math.sign(dy) * r) &&
    !isSolidAt(grid, player.x + r - 2, ny + Math.sign(dy) * r) &&
    !isSolidAt(grid, player.x, ny + Math.sign(dy) * r)
  ) {
    player.y = ny;
  }
}

/**
 * Advance the thief one frame. Returns a list of noise events the
 * game must act on: { type: 'step', loudness } for footsteps, and
 * { type: 'pebble', x, y } when a pebble was just thrown.
 */
export function updatePlayer(player, grid, input, dt) {
  const events = [];
  const dir = input.moveDirection();
  player.sneaking = input.isSneaking();
  player.moving = dir.x !== 0 || dir.y !== 0;
  if (player.moving) {
    const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const before = { x: player.x, y: player.y };
    moveWithCollision(player, grid, dir.x * speed * dt, dir.y * speed * dt);
    const moved = distance(before.x, before.y, player.x, player.y);
    player.stepDistance += moved;
    player.facing = Math.atan2(dir.y, dir.x);
    if (player.stepDistance >= STEP_LENGTH) {
      player.stepDistance -= STEP_LENGTH;
      // Walking is heard; sneaking is not.
      events.push({
        type: 'step',
        loudness: player.sneaking ? 0.25 : 1,
        heard: !player.sneaking,
      });
    }
  } else {
    player.stepDistance = 0;
  }

  // Bushes hide; anything else does not.
  player.inBush = isCoverTile(tileAt(grid, player.x, player.y));

  // A click throws a pebble at the clicked tile (if any are left).
  const click = input.takeClick();
  if (click && player.pebbles > 0) {
    const col = clamp(Math.floor(click.x / TILE_SIZE), 0, 23);
    const row = clamp(Math.floor(click.y / TILE_SIZE), 0, 15);
    player.pebbles -= 1;
    events.push({
      type: 'pebble',
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    });
  }
  return events;
}

/**
 * The guards that can hear the thief's footsteps right now: within
 * hearing range and with a clear line of sound (walls muffle it, so
 * a wall between thief and guard halves the range).
 */
export function guardsHearingFootsteps(guards, player, grid) {
  const heardBy = [];
  for (const guard of guards) {
    const dist = distance(guard.x, guard.y, player.x, player.y);
    if (dist > HEARING_RANGE) continue;
    heardBy.push(guard);
  }
  return heardBy;
}

/** Whether the thief stands on the exit tile. */
export function isOnTile(player, tile) {
  return Math.floor(player.x / TILE_SIZE) === tile.col &&
    Math.floor(player.y / TILE_SIZE) === tile.row;
}
