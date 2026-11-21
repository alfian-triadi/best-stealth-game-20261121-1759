// guard.js — the Lantern Wardens: patrol, suspicion, chase.
//
// A guard lives in one of five states:
//   patrol      — walks its waypoints, pausing at each one
//   suspicious  — stopped, staring at something half-seen; suspicion
//                 is climbing but the thief can still slip away
//   investigate — walks to the last seen (or heard) position to look
//   chase       — running at the thief, alarm raised
//   return      — walks back to the nearest waypoint and resumes patrol
//
// Suspicion is the heart of the game: it rises while the thief is
// seen and falls while hidden, so a near miss is recoverable. The
// guard only commits to a chase at full suspicion, and gives up
// after losing sight for a while, so patience is always rewarded.

import { angleDifference, clamp, distance } from './utils.js';
import { TILE_SIZE, isSolidAt } from './levels.js';
import { isInsideVisionCone, isInLanternLight } from './vision.js';

/** How far a guard can see, in pixels. */
export const VISION_RANGE = 210;
/** Half of the vision cone's angle (a 76-degree cone). */
export const VISION_HALF_ANGLE = 0.66;
/** How far away a guard can hear a walking thief. */
export const HEARING_RANGE = 95;
/** How far away a guard can hear a pebble landing. */
export const PEBBLE_HEARING_RANGE = 190;
/** Suspicion per second while the thief is plainly seen, up close. */
export const SPOT_RATE = 62;
/** Suspicion per second while the thief is not seen at all. */
export const CALM_RATE = 26;
/** Suspicion at which a guard stops to stare. */
export const SUSPICIOUS_AT = 34;
/** Seconds of lost sight before a chasing guard gives up. */
export const CHASE_GIVE_UP_SECONDS = 4;
/** How close a chasing guard must get to catch the thief. */
export const CATCH_DISTANCE = 26;

/** Build a guard from one level definition's guard entry. */
export function createGuard(def, index) {
  const [sx, sy] = def.spawn;
  const waypoints = def.waypoints.map(([col, row]) => ({
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }));
  return {
    id: index,
    x: sx * TILE_SIZE + TILE_SIZE / 2,
    y: sy * TILE_SIZE + TILE_SIZE / 2,
    facing: 0,
    state: 'patrol',
    suspicion: 0,
    waypoints,
    waypointIndex: 1 % waypoints.length,
    pauseLeft: 0,
    speed: def.speed,
    pauseSeconds: def.pauseSeconds,
    investigateAt: null,
    lastSeenAt: null,
    lostSightFor: 0,
    stepDistance: 0,
    wasSuspicious: false,
  };
}

/** Move toward a point, sliding along walls; returns pixels moved. */
function moveToward(guard, grid, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  let moved = 0;
  const radius = 13;
  if (!isSolidAt(grid, nx + Math.sign(dx) * radius, guard.y) &&
      !isSolidAt(grid, nx - Math.sign(dx) * radius, guard.y)) {
    moved += Math.abs(nx - guard.x);
    guard.x = nx;
  }
  if (!isSolidAt(grid, guard.x, ny + Math.sign(dy) * radius) &&
      !isSolidAt(grid, guard.x, ny - Math.sign(dy) * radius)) {
    moved += Math.abs(ny - guard.y);
    guard.y = ny;
  }
  guard.facing = Math.atan2(dy, dx);
  return moved;
}

/**
 * How fast suspicion rises while the thief is seen right now.
 * Closer is faster; lantern light makes it faster still; sneaking
 * makes it slower; hiding in a bush nearly stops it (unless the
 * guard is almost on top of the thief).
 */
export function detectionRate(guard, thief, lanterns, thiefHidden) {
  const dist = distance(guard.x, guard.y, thief.x, thief.y);
  const closeness = 1 - dist / VISION_RANGE;
  let rate = SPOT_RATE * (0.35 + 0.65 * closeness);
  if (isInLanternLight(lanterns, thief.x, thief.y)) rate *= 1.6;
  if (thief.sneaking) rate *= 0.55;
  if (thiefHidden) rate *= 0.12;
  return rate;
}

/**
 * Advance one guard by `dt` seconds. `events` collects what the game
 * needs to hear about: { type: 'spotted' | 'suspicious' | 'lost' }.
 * Returns nothing; the guard object is updated in place.
 */
export function updateGuard(guard, grid, thief, lanterns, dt, events) {
  const hidden = thief.inBush;
  const distToThief = distance(guard.x, guard.y, thief.x, thief.y);
  const canSee = thief.alive &&
    (!hidden || distToThief < 46) &&
    isInsideVisionCone(grid, guard, thief, VISION_RANGE, VISION_HALF_ANGLE);

  if (canSee) {
    guard.suspicion = clamp(
      guard.suspicion + detectionRate(guard, thief, lanterns, hidden) * dt,
      0,
      100,
    );
    guard.lastSeenAt = { x: thief.x, y: thief.y };
    guard.lostSightFor = 0;
  } else {
    guard.suspicion = clamp(guard.suspicion - CALM_RATE * dt, 0, 100);
    guard.lostSightFor += dt;
  }

  // Cross a threshold upward: the sting and the stare.
  if (guard.suspicion >= 100 && guard.state !== 'chase') {
    guard.state = 'chase';
    events.push({ type: 'spotted', guard });
  } else if (
    guard.suspicion >= SUSPICIOUS_AT &&
    guard.state === 'patrol' &&
    canSee
  ) {
    guard.state = 'suspicious';
    events.push({ type: 'suspicious', guard });
  }
  if (guard.suspicion < SUSPICIOUS_AT && guard.state === 'suspicious') {
    guard.state = 'patrol';
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
        break;
      }
      const target = guard.waypoints[guard.waypointIndex];
      const moved = moveToward(guard, grid, target.x, target.y, guard.speed, dt);
      guard.stepDistance += moved;
      if (distance(guard.x, guard.y, target.x, target.y) < 4) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseLeft = guard.pauseSeconds;
      }
      break;
    }
    case 'suspicious': {
      // Stand still and stare toward the last seen position.
      if (guard.lastSeenAt) {
        const want = Math.atan2(
          guard.lastSeenAt.y - guard.y,
          guard.lastSeenAt.x - guard.x,
        );
        const diff = want - guard.facing;
        const turn = clamp(diff, -2.4 * dt, 2.4 * dt);
        guard.facing += turn;
      }
      // Staring too long at nothing: go and look.
      if (guard.suspicion >= 55 && guard.lastSeenAt) {
        guard.state = 'investigate';
        guard.investigateAt = { ...guard.lastSeenAt };
      }
      break;
    }
    case 'investigate': {
      const target = guard.investigateAt;
      if (!target) {
        guard.state = 'return';
        break;
      }
      const moved = moveToward(guard, grid, target.x, target.y, guard.speed * 1.15, dt);
      guard.stepDistance += moved;
      if (distance(guard.x, guard.y, target.x, target.y) < 8) {
        guard.pauseLeft = 1.2;
        guard.state = 'return';
      }
      break;
    }
    case 'chase': {
      if (!thief.alive) break;
      const moved = moveToward(guard, grid, thief.x, thief.y, guard.speed * 2.9, dt);
      guard.stepDistance += moved;
      if (guard.lostSightFor > CHASE_GIVE_UP_SECONDS) {
        guard.state = 'investigate';
        guard.investigateAt = guard.lastSeenAt
          ? { ...guard.lastSeenAt }
          : { x: guard.x, y: guard.y };
        events.push({ type: 'lost', guard });
      }
      break;
    }
    case 'return': {
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
        if (guard.pauseLeft <= 0) {
          guard.state = 'patrol';
        }
        break;
      }
      // Head for the nearest waypoint, then resume the patrol.
      let best = guard.waypoints[0];
      let bestDist = Infinity;
      for (const point of guard.waypoints) {
        const d = distance(guard.x, guard.y, point.x, point.y);
        if (d < bestDist) {
          bestDist = d;
          best = point;
        }
      }
      const moved = moveToward(guard, grid, best.x, best.y, guard.speed * 1.15, dt);
      guard.stepDistance += moved;
      if (bestDist < 6) {
        guard.waypointIndex = guard.waypoints.indexOf(best);
        guard.state = 'patrol';
      }
      break;
    }
    default:
      break;
  }

  // A chasing guard that reaches the thief catches them (measured
  // after this frame's movement, so a guard that just closed the
  // gap counts).
  if (guard.state === 'chase' && thief.alive) {
    const now = distance(guard.x, guard.y, thief.x, thief.y);
    if (now < CATCH_DISTANCE) events.push({ type: 'caught', guard });
  }
}

/** A guard hears a noise at (x, y): walk over and look (unless chasing). */
export function guardHearNoise(guard, x, y) {
  if (guard.state === 'chase') return;
  guard.investigateAt = { x, y };
  guard.state = 'investigate';
  guard.suspicion = Math.max(guard.suspicion, SUSPICIOUS_AT);
}

/** The guard's current alert colour, for the HUD and the cone. */
export function guardAlertColor(guard) {
  if (guard.state === 'chase') return '#ff4d4d';
  if (guard.suspicion >= SUSPICIOUS_AT) return '#ffb020';
  return '#ffe9a8';
}
