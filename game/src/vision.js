// vision.js — what a guard can see, and what the light reveals.
//
// Sight is a cone: a target counts as seen when it is inside the
// guard's range and field of view and no wall or crate stands on the
// line between them. Lantern light is separate: standing in a lit
// circle makes the thief easier to spot, which the guard's detection
// rate reads, not this file.

import { angleDifference, distance } from './utils.js';
import { TILE_SIZE, isSolidAt } from './levels.js';

/** The radius of one lantern's light, in pixels. */
export const LANTERN_RADIUS = 95;

/**
 * Whether a straight line between two points crosses a solid tile.
 * Walks the line in small steps (DDA would be exact; a 4 px step is
 * far finer than a tile and keeps the code short and obvious).
 */
export function hasLineOfSight(grid, ax, ay, bx, by) {
  const dist = distance(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (isSolidAt(grid, x, y)) return false;
  }
  return true;
}

/**
 * Whether `target` is inside a guard's vision cone: within range,
 * inside the half-angle, and with a clear line of sight.
 * `facing` is the guard's facing angle in radians.
 */
export function isInsideVisionCone(grid, guard, target, range, halfAngle) {
  const dist = distance(guard.x, guard.y, target.x, target.y);
  if (dist > range) return false;
  const toTarget = Math.atan2(target.y - guard.y, target.x - guard.x);
  if (angleDifference(toTarget, guard.facing) > halfAngle) return false;
  return hasLineOfSight(grid, guard.x, guard.y, target.x, target.y);
}

/** Whether a point stands inside any lantern's lit circle. */
export function isInLanternLight(lanterns, x, y) {
  for (const lantern of lanterns) {
    if (distance(lantern.x, lantern.y, x, y) < LANTERN_RADIUS) return true;
  }
  return false;
}

/**
 * The tiles a tile position can see, for the darkness overlay: the
 * game draws the floor dark and lights only what is near the thief
 * and inside guards' cones. Kept here so render.js stays drawing-only.
 */
export function tileCenter(col, row) {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}
