// Exercises the desktop boundary rules in the ROOT eslint.config.js. Needs the root install (`yarn install` at the
// repo root); run with `yarn --cwd desktop test:root-boundary`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { ESLint } = createRequire(path.join(repoRoot, 'package.json'))('eslint');
const eslint = new ESLint({ cwd: repoRoot });

const BOUNDARY_RULES = new Set(['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax']);

async function boundaryErrors(relativePath, code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, relativePath) });
  assert.ok(result, `no lint result for ${relativePath}`);
  const fatal = result.messages.filter((m) => m.fatal || m.ruleId === null);
  assert.deepEqual(fatal, [], `${relativePath} was ignored or failed to parse`);
  return result.messages.filter((m) => BOUNDARY_RULES.has(m.ruleId ?? ''));
}

describe('renderer boundary: no electron or Node builtins in public/ and packages/', () => {
  const violating = [
    ['public/app/core/__boundary_fixture__.ts', `import fs from 'fs';\nexport const x = fs;\n`],
    [
      'public/app/core/__boundary_fixture__.ts',
      `import { readFile } from 'fs/promises';\nexport const x = readFile;\n`,
    ],
    ['public/app/core/__boundary_fixture__.ts', `import { join } from 'node:path';\nexport const x = join;\n`],
    ['public/app/core/__boundary_fixture__.tsx', `import { shell } from 'electron';\nexport const x = shell;\n`],
    ['public/app/core/__boundary_fixture__.ts', `export { exec } from 'child_process';\n`],
    ['packages/grafana-ui/src/__boundary_fixture__.ts', `import path from 'path';\nexport const x = path;\n`],
    ['packages/grafana-ui/src/__boundary_fixture__.ts', `import os from 'os';\nexport const x = os;\n`],
    ['packages/grafana-data/src/__boundary_fixture__.ts', `import net from 'net';\nexport const x = net;\n`],
    [
      'packages/grafana-data/src/__boundary_fixture__.ts',
      `import type { Stats } from 'node:fs';\nexport type X = Stats;\n`,
    ],
    [
      'public/app/core/__boundary_fixture__.js',
      `import { ipcRenderer } from 'electron/renderer';\nexport const x = ipcRenderer;\n`,
    ],
    ['public/app/core/__boundary_fixture__.js', `const fs = require('fs');\nmodule.exports = fs;\n`],
    ['packages/grafana-ui/src/__boundary_fixture__.ts', `export const load = () => import('node:child_process');\n`],
  ];
  for (const [file, code] of violating) {
    it(`rejects ${JSON.stringify(code.split('\n')[0])} in ${file}`, async () => {
      const errors = await boundaryErrors(file, code);
      assert.ok(errors.length > 0, 'expected a boundary error');
    });
  }

  const allowed = [
    [
      'public/app/core/__boundary_fixture__.ts',
      `import { compile } from 'path-to-regexp';\nexport const x = compile;\n`,
    ],
    ['public/app/core/__boundary_fixture__.ts', `import { thing } from 'app/core/path';\nexport const x = thing;\n`],
    ['public/app/core/__boundary_fixture__.test.ts', `import fs from 'fs';\nexport const x = fs;\n`],
    ['public/app/core/__boundary_fixture__.js', `const p = require('path-browserify');\nmodule.exports = p;\n`],
    [
      'packages/grafana-eslint-rules/__boundary_fixture__.cjs',
      `const path = require('path');\nmodule.exports = path;\n`,
    ],
    [
      'packages/grafana-ui/rollup.config.ts',
      `import { createRequire } from 'node:module';\nexport const x = createRequire;\n`,
    ],
    ['scripts/__boundary_fixture__.ts', `import fs from 'fs';\nexport const x = fs;\n`],
  ];
  for (const [file, code] of allowed) {
    it(`allows ${JSON.stringify(code.split('\n')[0])} in ${file}`, async () => {
      assert.deepEqual(await boundaryErrors(file, code), []);
    });
  }
});

describe('no raw ipcRenderer outside desktop/src/preload/', () => {
  const violating = [
    ['scripts/__boundary_fixture__.ts', `import { ipcRenderer } from 'electron';\nexport const x = ipcRenderer;\n`],
    ['e2e/__boundary_fixture__.js', `const { ipcRenderer } = require('electron');\nmodule.exports = ipcRenderer;\n`],
    [
      'scripts/__boundary_fixture__.ts',
      `import * as electron from 'electron';\nexport const x = electron.ipcRenderer;\n`,
    ],
    ['packages/grafana-eslint-rules/__boundary_fixture__.cjs', `module.exports = require('electron').ipcRenderer;\n`],
  ];
  for (const [file, code] of violating) {
    it(`rejects ${JSON.stringify(code.split('\n')[0])} in ${file}`, async () => {
      const errors = await boundaryErrors(file, code);
      assert.ok(
        errors.some((e) => e.message.includes('ipcRenderer')),
        `expected an ipcRenderer error, got ${JSON.stringify(errors)}`
      );
    });
  }

  it('allows other electron imports outside public/ and packages/', async () => {
    const code = `import { app } from 'electron';\nexport const x = app;\n`;
    assert.deepEqual(await boundaryErrors('scripts/__boundary_fixture__.ts', code), []);
  });
});
