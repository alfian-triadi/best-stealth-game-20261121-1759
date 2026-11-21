// utils.js — small shared helpers for Ember Thief.
// No game logic lives here, only pure math and a seeded random source
// so decorative details (fireflies, grass tufts) are stable per level.

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Euclidean distance between two points. */
export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

/** Angle from (ax, ay) toward (bx, by), in radians. */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Deterministic random generator (mulberry32). One instance per level,
 * seeded from the level number, so decorative placement never changes
 * between runs of the same level.
 */
export function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array using the given random function. */
export function pickRandom(random, items) {
  return items[Math.floor(random() * items.length)];
}
