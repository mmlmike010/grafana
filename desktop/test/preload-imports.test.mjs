import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkPreloadImports } from '../scripts/check-preload-imports.mjs';

const tmpRoots = [];
after(() => tmpRoots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function fixture(files) {
  const srcDir = mkdtempSync(path.join(tmpdir(), 'preload-fixture-'));
  tmpRoots.push(srcDir);
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(srcDir, rel)), { recursive: true });
    writeFileSync(path.join(srcDir, rel), contents);
  }
  return srcDir;
}

describe('check-preload-imports', () => {
  it('passes on the real desktop/src', () => {
    const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
    assert.deepEqual(checkPreloadImports(srcDir), []);
  });

  it('allows contextBridge/ipcRenderer, type-only electron imports, and ../shared', () => {
    const srcDir = fixture({
      'preload/index.ts': [
        `import { contextBridge, ipcRenderer } from 'electron';`,
        `import type { IpcRendererEvent, WebContents } from 'electron';`,
        `import { type BrowserWindow } from 'electron';`,
        `import { CHANNELS } from '../shared/channels';`,
        `import { helper } from './helper';`,
        `export type T = IpcRendererEvent | WebContents | BrowserWindow;`,
        `contextBridge.exposeInMainWorld('x', { CHANNELS, helper, ipcRenderer });`,
      ].join('\n'),
      'preload/helper.ts': `export const helper = 1;\n`,
      'shared/channels.ts': `import { BASE } from './base';\nexport const CHANNELS = [BASE];\n`,
      'shared/base.ts': `export const BASE = 'x';\n`,
    });
    assert.deepEqual(checkPreloadImports(srcDir), []);
  });

  const violating = {
    'a Node builtin': `import fs from 'node:fs';\n`,
    'a bare Node builtin': `import { join } from 'path';\n`,
    'an npm package': `import debounce from 'lodash/debounce';\n`,
    'a non-allowlisted electron API': `import { shell } from 'electron';\n`,
    'an electron namespace import': `import * as electron from 'electron';\n`,
    'an electron default import': `import electron from 'electron';\n`,
    'an electron re-export': `export { ipcRenderer } from 'electron';\n`,
    'require()': `const { ipcRenderer } = require('electron');\n`,
    'dynamic import()': `export const load = () => import('../shared/channels');\n`,
    'a relative import outside preload/shared': `import { x } from '../main/x';\n`,
    'an unresolvable relative import': `import { x } from './missing';\n`,
  };
  for (const [name, code] of Object.entries(violating)) {
    it(`rejects ${name}`, () => {
      const srcDir = fixture({
        'preload/index.ts': code,
        'main/x.ts': `export const x = 1;\n`,
        'shared/channels.ts': `export const CHANNELS = [];\n`,
      });
      const violations = checkPreloadImports(srcDir);
      assert.equal(violations.length, 1, JSON.stringify(violations));
      assert.equal(violations[0].file, path.join('preload', 'index.ts'));
    });
  }

  it('follows preload imports into shared and rejects shared code that leaks electron or main', () => {
    const srcDir = fixture({
      'preload/index.ts': `import { a } from '../shared/a';\nexport const x = a;\n`,
      'shared/a.ts': `import { app } from 'electron';\nimport { m } from '../main/m';\nexport const a = [app, m];\n`,
      'main/m.ts': `export const m = 1;\n`,
    });
    const violations = checkPreloadImports(srcDir);
    assert.deepEqual(
      violations.map((v) => [v.file, v.line]),
      [
        [path.join('shared', 'a.ts'), 1],
        [path.join('shared', 'a.ts'), 2],
      ]
    );
  });
});
