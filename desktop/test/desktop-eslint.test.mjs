import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: desktopRoot });

async function ipcRendererErrors(relativePath, code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(desktopRoot, relativePath) });
  assert.ok(result);
  return result.messages.filter((m) => m.message.includes('ipcRenderer'));
}

describe('desktop ESLint: raw ipcRenderer only in src/preload/', () => {
  const violating = [
    ['src/main/fixture.ts', `import { ipcRenderer } from 'electron';\nexport const x = ipcRenderer;\n`],
    ['src/shared/fixture.ts', `import * as electron from 'electron';\nexport const x = electron.ipcRenderer;\n`],
    [
      'scripts/fixture.mjs',
      `import electron from 'electron';\nconst { ipcRenderer } = electron;\nexport { ipcRenderer };\n`,
    ],
  ];
  for (const [file, code] of violating) {
    it(`rejects ipcRenderer in ${file}`, async () => {
      assert.ok((await ipcRendererErrors(file, code)).length > 0);
    });
  }

  it('allows ipcRenderer in src/preload/', async () => {
    const code = `import { ipcRenderer } from 'electron';\nexport const x = ipcRenderer;\n`;
    assert.deepEqual(await ipcRendererErrors('src/preload/fixture.ts', code), []);
  });
});
