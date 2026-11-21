// levels.js — the three hand-designed levels of Ember Thief.
//
// Tile legend (each map is 24 columns by 16 rows):
//   #  stone wall    — blocks movement and sight
//   .  floor         — open ground
//   ,  moss floor    — open ground, decorative
//   B  moonbloom bush — walkable cover: a thief inside is hidden
//   C  crate         — blocks movement and sight, low cover
//   L  lantern post  — walkable floor with a lantern; its light makes
//                      a thief easier to spot, so it is also a warning
//   P  the thief's starting tile
//   E  the moon gate (exit) — opens once every ember shard is taken
//   S  an ember shard to steal
//
// Guard patrols are listed per level as tile waypoints. Every leg of a
// patrol runs along open floor so a guard never has to pathfind.

export const TILE_SIZE = 40;
export const MAP_COLS = 24;
export const MAP_ROWS = 16;

export const LEVELS = [
  {
    name: 'The Moonlit Garden',
    subtitle: 'Learn the patrols. Bushes hide you; lantern light betrays you.',
    parSeconds: 90,
    pebbles: 5,
    map: [
      '########################',
      '#P.....,......#........#',
      '#......B......#....S...#',
      '#..B.....,....#........#',
      '#......#..####....##...#',
      '#......#..#........#...#',
      '#.####.#..#..B..#..#...#',
      '#.#......#....#.#..#...#',
      '#.#..S...#....#.#......#',
      '#.#......#....#.#..B...#',
      '#....#####....#.#......#',
      '#..B.....#....#...#....#',
      '#........#....#...#....#',
      '#...B....#....#...#....#',
      '#....S......B.....#...E#',
      '########################',
    ],
    guards: [
      {
        spawn: [17, 2],
        waypoints: [[17, 2], [21, 2], [21, 3], [17, 3]],
        speed: 52,
        pauseSeconds: 1.2,
      },
      {
        spawn: [10, 8],
        waypoints: [[10, 8], [10, 12], [13, 12], [13, 8]],
        speed: 48,
        pauseSeconds: 1.6,
      },
    ],
  },
  {
    name: 'The Ember Vault',
    subtitle: 'Three wardens now. Throw a pebble to pull one away.',
    parSeconds: 120,
    pebbles: 5,
    map: [
      '########################',
      '#P...#.......#....S....#',
      '#....#..B....#.........#',
      '#.##.#.......#.####....#',
      '#.##.#..S....#.#.......#',
      '#....#.......#.#..B....#',
      '###..###.#####.#.......#',
      '#......#.....#.#..##...#',
      '#..B...#..B..#....#....#',
      '#......#.....#.##.#.S..#',
      '#.######..####.#..#....#',
      '#........B......#......#',
      '#..S....#...#..#..B....#',
      '#.......#...#.....#....#',
      '#..B....#...#..S..#..E.#',
      '########################',
    ],
    guards: [
      {
        spawn: [17, 1],
        waypoints: [[17, 1], [21, 1], [21, 2], [17, 2]],
        speed: 56,
        pauseSeconds: 1.0,
      },
      {
        spawn: [9, 7],
        waypoints: [[9, 7], [12, 7], [12, 9], [9, 9]],
        speed: 52,
        pauseSeconds: 1.4,
      },
      {
        spawn: [2, 11],
        waypoints: [[2, 11], [7, 11], [7, 13], [2, 13]],
        speed: 50,
        pauseSeconds: 1.2,
      },
    ],
  },
  {
    name: "The Warden's Court",
    subtitle: 'Four wardens, tight lanes. Patience is the only way through.',
    parSeconds: 150,
    pebbles: 6,
    map: [
      '########################',
      '#P.....#......#........#',
      '#..B...#..S...#...B....#',
      '#......#......#........#',
      '###.####..#####..###...#',
      '#.......#......#....#..#',
      '#..S....#..B...#....#..#',
      '#.......#......#.##.#..#',
      '#.#######..#####.#..#..#',
      '#........#.....#.#..#..#',
      '#..B..#..#..S..#....#..#',
      '#.....#..#.....#.##.#..#',
      '#..S..#..#..B..#....#..#',
      '#.....#.....#.....#....#',
      '#..B..#..S....#..#...E.#',
      '########################',
    ],
    guards: [
      {
        spawn: [18, 2],
        waypoints: [[18, 2], [21, 2], [21, 3], [18, 3]],
        speed: 60,
        pauseSeconds: 0.9,
      },
      {
        spawn: [9, 5],
        waypoints: [[9, 5], [13, 5], [13, 7], [9, 7]],
        speed: 56,
        pauseSeconds: 1.1,
      },
      {
        spawn: [1, 11],
        waypoints: [[1, 11], [5, 11], [5, 13], [1, 13]],
        speed: 54,
        pauseSeconds: 1.3,
      },
      {
        spawn: [21, 5],
        waypoints: [[21, 5], [21, 13], [22, 13], [22, 5]],
        speed: 58,
        pauseSeconds: 1.0,
      },
    ],
  },
];

/** A tile blocks movement and sight (walls and crates). */
export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

/** A tile the thief can stand on. */
export function isWalkableTile(ch) {
  return !isSolidTile(ch);
}

/** A tile that hides the thief (bushes). */
export function isCoverTile(ch) {
  return ch === 'B';
}

/** A tile that carries a lantern (its light raises detection). */
export function isLanternTile(ch) {
  return ch === 'L';
}

/**
 * Parse one level definition into runtime data: the tile grid, the
 * thief's start in pixels, the shard and lantern positions, and the
 * exit tile. Throws when the map is malformed.
 */
export function parseLevel(def) {
  if (def.map.length !== MAP_ROWS) {
    throw new Error(`${def.name}: map has ${def.map.length} rows, expected ${MAP_ROWS}`);
  }
  const grid = [];
  let start = null;
  let exit = null;
  const shards = [];
  const lanterns = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = def.map[row];
    if (line.length !== MAP_COLS) {
      throw new Error(`${def.name}: row ${row} is ${line.length} tiles, expected ${MAP_COLS}`);
    }
    const tiles = [];
    for (let col = 0; col < MAP_COLS; col++) {
      const ch = line[col];
      tiles.push(ch);
      const cx = col * TILE_SIZE + TILE_SIZE / 2;
      const cy = row * TILE_SIZE + TILE_SIZE / 2;
      if (ch === 'P') {
        if (start) throw new Error(`${def.name}: two player starts`);
        start = { x: cx, y: cy, col, row };
      } else if (ch === 'E') {
        if (exit) throw new Error(`${def.name}: two exits`);
        exit = { x: cx, y: cy, col, row };
      } else if (ch === 'S') {
        shards.push({ x: cx, y: cy, col, row, taken: false });
      } else if (ch === 'L') {
        lanterns.push({ x: cx, y: cy, col, row });
      }
    }
    grid.push(tiles);
  }
  if (!start) throw new Error(`${def.name}: no player start (P)`);
  if (!exit) throw new Error(`${def.name}: no exit (E)`);
  if (shards.length === 0) throw new Error(`${def.name}: no ember shards (S)`);
  return { def, grid, start, exit, shards, lanterns };
}

/** The tile character at a pixel position, or '#' outside the map. */
export function tileAt(grid, px, py) {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return '#';
  return grid[row][col];
}

/** Whether a pixel position is inside a solid tile. */
export function isSolidAt(grid, px, py) {
  return isSolidTile(tileAt(grid, px, py));
}
