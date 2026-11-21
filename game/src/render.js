// render.js — everything Ember Thief draws.
//
// The look is a night garden: dark slate floors, stone walls,
// moonbloom bushes, warm lantern light and glowing ember shards.
// A darkness mask is painted last, with light punched out around
// the thief, the lanterns and the exit, so the player can read at a
// glance what is safe and what is lit. Vision cones are raycast
// tile by tile, so a wall genuinely cuts a cone short.

import { TILE_SIZE, MAP_COLS, MAP_ROWS, isSolidTile } from './levels.js';
import { VISION_RANGE, VISION_HALF_ANGLE, guardAlertColor } from './guard.js';
import { LANTERN_RADIUS } from './vision.js';

const CANVAS_WIDTH = MAP_COLS * TILE_SIZE;
const CANVAS_HEIGHT = MAP_ROWS * TILE_SIZE;

/** How many rays make up one vision cone. */
const CONE_RAYS = 26;

/** The darkness overlay's opacity away from any light. */
const DARKNESS = 0.4;

/**
 * Cast one ray of a guard's cone until it hits a wall or the range
 * ends, and return how far the light reaches along that angle.
 */
function coneRayLength(grid, gx, gy, angle) {
  const step = 6;
  for (let d = step; d <= VISION_RANGE; d += step) {
    const x = gx + Math.cos(angle) * d;
    const y = gy + Math.sin(angle) * d;
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return d;
    if (isSolidTile(grid[row][col])) return d;
  }
  return VISION_RANGE;
}

/** The vision cone as a polygon, its edge stopped by walls. */
function conePolygon(grid, guard) {
  const points = [];
  for (let i = 0; i <= CONE_RAYS; i++) {
    const angle = guard.facing - VISION_HALF_ANGLE +
      (2 * VISION_HALF_ANGLE * i) / CONE_RAYS;
    const len = coneRayLength(grid, guard.x, guard.y, angle);
    points.push([guard.x + Math.cos(angle) * len, guard.y + Math.sin(angle) * len]);
  }
  return points;
}

function drawFloor(ctx, grid, time, fireflies) {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const ch = grid[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const checker = (col + row) % 2 === 0;
      if (ch === '#') {
        ctx.fillStyle = '#2e3d52';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#41586f';
        ctx.fillRect(x, y, TILE_SIZE, 5);
        ctx.fillStyle = '#22303f';
        ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
      } else if (ch === 'C') {
        ctx.fillStyle = checker ? '#3a2f22' : '#43382a';
        ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.strokeStyle = '#241c12';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      } else {
        // Mossy floor, with a faint checker and speckles.
        ctx.fillStyle = ch === ','
          ? checker ? '#28443a' : '#233d33'
          : checker ? '#2c3f55' : '#28394e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x + 6, y + 6, 3, 3);
        ctx.fillRect(x + 26, y + 28, 3, 3);
      }
      if (ch === 'B') {
        // Moonbloom bush: layered leaves with pale buds.
        ctx.fillStyle = '#173d26';
        ctx.beginPath();
        ctx.arc(x + 12, y + 22, 13, 0, Math.PI * 2);
        ctx.arc(x + 26, y + 16, 12, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 30, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a6b3f';
        ctx.beginPath();
        ctx.arc(x + 14, y + 18, 8, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 26, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cfe8ff';
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 2.5, 0, Math.PI * 2);
        ctx.arc(x + 28, y + 20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ch === 'L') {
        ctx.fillStyle = '#4a3416';
        ctx.fillRect(x + 17, y + 14, 6, 20);
        ctx.fillStyle = '#ffb020';
        ctx.beginPath();
        ctx.arc(x + 20, y + 12, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Drifting fireflies, purely decorative.
  for (const fly of fireflies) {
    const fx = fly.x + Math.sin(time * fly.speed + fly.phase) * 8;
    const fy = fly.y + Math.cos(time * fly.speed * 0.8 + fly.phase) * 6;
    const glow = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.4 + fly.phase));
    ctx.fillStyle = `rgba(190, 255, 170, ${0.55 * glow})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, exit, open, time) {
  const pulse = open ? 0.75 + 0.25 * Math.sin(time * 3) : 0.3;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.strokeStyle = open ? `rgba(180, 220, 255, ${pulse})` : 'rgba(120, 140, 170, 0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 4, 17, Math.PI, 0);
  ctx.moveTo(-17, 4);
  ctx.lineTo(-17, 16);
  ctx.moveTo(17, 4);
  ctx.lineTo(17, 16);
  ctx.stroke();
  ctx.fillStyle = open ? `rgba(190, 225, 255, ${0.25 + 0.2 * pulse})` : 'rgba(90, 110, 140, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 4, 15, Math.PI, 0);
  ctx.lineTo(15, 16);
  ctx.lineTo(-15, 16);
  ctx.closePath();
  ctx.fill();
  if (open) {
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', 0, -22);
  }
  ctx.restore();
}

function drawShards(ctx, shards, time) {
  for (const shard of shards) {
    if (shard.taken) continue;
    const bob = Math.sin(time * 2 + shard.col) * 3;
    const glow = 0.55 + 0.35 * Math.sin(time * 3 + shard.row);
    ctx.save();
    ctx.translate(shard.x, shard.y + bob);
    const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
    gradient.addColorStop(0, `rgba(255, 140, 40, ${0.5 * glow})`);
    gradient.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe1a8';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawVisionCones(ctx, grid, guards) {
  for (const guard of guards) {
    const color = guardAlertColor(guard);
    const polygon = conePolygon(grid, guard);
    const gradient = ctx.createRadialGradient(
      guard.x, guard.y, 8, guard.x, guard.y, VISION_RANGE,
    );
    const alpha = guard.state === 'chase' ? 0.4 : 0.28;
    gradient.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (const [x, y] of polygon) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGuard(ctx, guard, time) {
  const color = guardAlertColor(guard);
  const bob = guard.state === 'chase' ? Math.sin(time * 14) * 1.5 : 0;
  ctx.save();
  ctx.translate(guard.x, guard.y + bob);
  // Lantern glow at the guard's feet.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  glow.addColorStop(0, 'rgba(255, 176, 32, 0.25)');
  glow.addColorStop(1, 'rgba(255, 176, 32, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  // Body: a warden in a deep red cloak.
  ctx.fillStyle = '#7a2e2e';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5d2222';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI);
  ctx.fill();
  // Facing: a brass lantern held out front.
  const lx = Math.cos(guard.facing) * 15;
  const ly = Math.sin(guard.facing) * 15;
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1a10';
  ctx.beginPath();
  ctx.arc(Math.cos(guard.facing) * 7, Math.sin(guard.facing) * 7, 3, 0, Math.PI * 2);
  ctx.fill();
  // Suspicion arc above the head.
  if (guard.suspicion > 1) {
    const frac = guard.suspicion / 100;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -20, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    if (guard.state === 'chase') {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -32);
    } else if (guard.state === 'suspicious' || guard.state === 'investigate') {
      ctx.fillStyle = '#ffb020';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -32);
    }
  }
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  if (!player.alive) return;
  const bob = player.moving ? Math.sin(time * (player.sneaking ? 8 : 12)) * 1.2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  // Soft ember glow the thief carries.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  glow.addColorStop(0, 'rgba(255, 170, 60, 0.22)');
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  // Hooded cloak, dark teal with an amber clasp.
  ctx.fillStyle = player.inBush ? '#1e4d33' : '#14424a';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e2f36';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI);
  ctx.fill();
  const fx = Math.cos(player.facing) * 8;
  const fy = Math.sin(player.facing) * 8;
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.arc(fx, fy, 3, 0, Math.PI * 2);
  ctx.fill();
  // Eyes: two pale dots looking where the thief faces.
  const ex = Math.cos(player.facing + Math.PI / 2) * 4;
  const ey = Math.sin(player.facing + Math.PI / 2) * 4;
  ctx.fillStyle = '#eaf6ff';
  ctx.beginPath();
  ctx.arc(fx * 0.4 + ex, fy * 0.4 + ey, 1.8, 0, Math.PI * 2);
  ctx.arc(fx * 0.4 - ex, fy * 0.4 - ey, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRipples(ctx, ripples) {
  for (const ripple of ripples) {
    const age = ripple.age / ripple.life;
    if (age >= 1) continue;
    ctx.strokeStyle = `rgba(190, 220, 255, ${0.7 * (1 - age)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, 6 + age * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDarkness(ctx, view, time) {
  const mask = document.createElement('canvas');
  mask.width = CANVAS_WIDTH;
  mask.height = CANVAS_HEIGHT;
  const mctx = mask.getContext('2d');
  mctx.fillStyle = `rgba(5, 10, 24, ${DARKNESS})`;
  mctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  mctx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, radius, strength) => {
    const g = mctx.createRadialGradient(x, y, 4, x, y, radius);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g;
    mctx.beginPath();
    mctx.arc(x, y, radius, 0, Math.PI * 2);
    mctx.fill();
  };
  // The thief always carries a little light.
  punch(view.player.x, view.player.y, 175, 0.9);
  for (const lantern of view.lanterns) {
    punch(lantern.x, lantern.y, LANTERN_RADIUS + 45, 0.8);
  }
  for (const shard of view.shards) {
    if (!shard.taken) punch(shard.x, shard.y, 70, 0.65);
  }
  if (view.exitOpen) punch(view.exit.x, view.exit.y, 100, 0.85);
  // A guard's lantern lights its cone faintly.
  for (const guard of view.guards) {
    punch(guard.x, guard.y, 95, 0.5);
  }
  ctx.drawImage(mask, 0, 0);
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.45,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.95,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function overlayPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 12, 24, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_WIDTH / 2, 240);
  ctx.fillStyle = '#dfe9f5';
  ctx.font = '17px system-ui, sans-serif';
  let y = 290;
  for (const line of lines) {
    ctx.fillText(line, CANVAS_WIDTH / 2, y);
    y += 30;
  }
}

/** Draw one frame of the game. `view` is the object game.js builds. */
export function drawGame(ctx, view, time) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawFloor(ctx, view.grid, time, view.fireflies);
  drawExit(ctx, view.exit, view.exitOpen, time);
  drawShards(ctx, view.shards, time);
  drawVisionCones(ctx, view.grid, view.guards);
  drawRipples(ctx, view.ripples);
  for (const guard of view.guards) drawGuard(ctx, guard, time);
  drawPlayer(ctx, view.player, time);
  drawDarkness(ctx, view, time);
  drawVignette(ctx);

  if (view.screen === 'title') {
    overlayPanel(ctx, 'EMBER THIEF', [
      'Steal every ember shard, then slip through the moon gate unseen.',
      '',
      'WASD / arrows — move      Shift — sneak (slow, quiet)',
      'Click — throw a pebble to distract a guard      M — mute',
      'Bushes hide you. Lantern light gives you away. Watch the cones.',
      '',
      'Press Enter to begin',
    ], '#ffb020');
  } else if (view.screen === 'caught') {
    overlayPanel(ctx, 'CAUGHT!', [
      'A warden caught you in the lamplight.',
      '',
      `Level ${view.levelNumber} — ${view.levelName}`,
      'Press R to try the level again',
    ], '#ff4d4d');
  } else if (view.screen === 'levelComplete') {
    overlayPanel(ctx, 'LEVEL CLEAR', [
      `${view.levelName} — all shards stolen, gate slipped through.`,
      '',
      `Time: ${view.levelTimeText}   (par ${view.parText})`,
      'Press Enter for the next garden',
    ], '#7ddb8a');
  } else if (view.screen === 'win') {
    overlayPanel(ctx, 'THE EMBER THIEF', [
      'Every shard stolen. Every garden crossed. Never once seen.',
      '',
      `Total time: ${view.totalTimeText}      Shards: ${view.totalShards}`,
      'Press R to play again',
    ], '#ffd27a');
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
