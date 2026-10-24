import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The preload runs on every page load in the renderer; anything that grows it past this is doing too much.
const PRELOAD_SIZE_BUDGET_BYTES = 16 * 1024;

const shared = {
  bundle: true,
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'warning',
  absWorkingDir: root,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ['src/main/index.ts'],
    outfile: 'dist/main/index.js',
    platform: 'node',
    target: 'node22',
  }),
  // A sandboxed preload cannot require() relative files, so it must be a single bundle. platform=browser makes
  // esbuild refuse Node builtins as a second line of defence behind check-preload-imports.mjs.
  build({
    ...shared,
    entryPoints: ['src/preload/index.ts'],
    outfile: 'dist/preload/index.js',
    platform: 'browser',
    target: 'chrome120',
  }),
]);

const preloadBytes = statSync(path.join(root, 'dist/preload/index.js')).size;
if (preloadBytes > PRELOAD_SIZE_BUDGET_BYTES) {
  console.error(`preload bundle is ${preloadBytes} bytes, over the ${PRELOAD_SIZE_BUDGET_BYTES} byte budget`);
  process.exit(1);
}
