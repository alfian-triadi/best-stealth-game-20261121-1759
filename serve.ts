// serve.ts — a tiny static server for playing Ember Thief locally.
//
// Serves game/ at http://localhost:8080 so the game can be opened
// in desktop Chrome exactly as the grader serves it: static files,
// no network, no build step. Usage: `node serve.ts` (then open
// http://localhost:8080), or `node serve.ts 9090` for another port.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const GAME_ROOT = resolve('game');
const PORT = Number(process.argv[2] ?? 8080);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = resolve(join(GAME_ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, '')));
    if (!filePath.startsWith(GAME_ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    const bytes = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'content-length': bytes.length,
    });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Ember Thief at http://localhost:${PORT}`);
});
