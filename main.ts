// main.ts — Ember Thief's hand-in program.
//
// Runs on Node 22 with the standard library only, in a fresh
// container with no network: it copies game/ and screenshots/ from
// this repository into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
//
// The program is deterministic: the same repository always writes
// the same bytes, so the grader's two runs match byte for byte.

import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The repository root: the directory this file lives in. */
const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

/** Where the entry goes: the grader's /output, or MAKEFUN_OUTPUT_DIR. */
function outputDirectory(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  return fromEnv ? resolve(fromEnv) : '/output';
}

/** The dossier caps this competition's gate uses. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
} as const;

/**
 * Copy one directory tree into the output directory, refusing
 * symbolic links (the gate only accepts plain files and directories).
 */
function copyPlainTree(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) {
    throw new Error(`main.ts: ${sourceDir}: no such directory`);
  }
  const rootStat = lstatSync(sourceDir);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`main.ts: ${sourceDir}: not a plain directory`);
  }
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: false,
    filter: (source: string) => {
      if (lstatSync(source).isSymbolicLink()) {
        throw new Error(`main.ts: ${source}: a symbolic link (game/ holds plain files only)`);
      }
      return true;
    },
  });
}

/** Empty the output directory and lay the entry out in it. */
function layOutEntry(outDir: string): void {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyPlainTree(join(REPO_ROOT, 'game'), join(outDir, 'game'));
  copyPlainTree(join(REPO_ROOT, 'screenshots'), join(outDir, 'screenshots'));
}

function main(): void {
  const outDir = outputDirectory();
  layOutEntry(outDir);
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`main.ts: wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
}

main();
