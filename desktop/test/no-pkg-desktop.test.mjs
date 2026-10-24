import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/check-no-pkg-desktop.sh');

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

const tmpRoots = [];
after(() => tmpRoots.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
}

function write(repo, files) {
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    writeFileSync(path.join(repo, rel), contents);
  }
}

// A repo with a `main` base commit and a `feature` branch carrying `changes`.
function repoWithChanges(changes) {
  const repo = mkdtempSync(path.join(tmpdir(), 'pkg-desktop-'));
  tmpRoots.push(repo);
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, {
    'pkg/api/api.go': 'package api\n\nfunc register(r Router) {\n\tr.Get("/api/health", health)\n}\n',
    'public/app/index.ts': 'export {};\n',
  });
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'checkout', '-q', '-b', 'feature');
  write(repo, changes);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'change');
  return repo;
}

function run(repo, ...args) {
  return spawnSync('bash', [script, ...args], { cwd: repo, env: gitEnv, encoding: 'utf8' });
}

describe('check-no-pkg-desktop.sh', () => {
  it('passes when pkg/ is untouched', () => {
    const res = run(repoWithChanges({ 'desktop/src/main/index.ts': "import 'electron';\n" }), 'main');
    assert.equal(res.status, 0, res.stderr);
  });

  it('passes on ordinary pkg/ changes', () => {
    const repo = repoWithChanges({
      'pkg/api/api.go':
        'package api\n\nfunc register(r Router) {\n\tr.Get("/api/health", health)\n\tr.Get("/api/frontend/settings", s)\n}\n',
      'pkg/services/dashboards/service.go': 'package dashboards\n',
    });
    assert.equal(run(repo, 'main').status, 0);
  });

  const violating = {
    'a desktop-named file': { 'pkg/api/desktop.go': 'package api\n' },
    'a desktop-named package directory': { 'pkg/services/desktopbridge/service.go': 'package desktopbridge\n' },
    'an electron-named file': { 'pkg/middleware/electron_auth.go': 'package middleware\n' },
    'a /desktop route': {
      'pkg/api/api.go':
        'package api\n\nfunc register(r Router) {\n\tr.Get("/api/health", health)\n\tr.Get("/api/desktop/info", info)\n}\n',
    },
    'an electron reference': { 'pkg/api/ua.go': 'package api\n\nconst shellUA = "Electron/"\n' },
  };
  for (const [name, changes] of Object.entries(violating)) {
    it(`fails on ${name}`, () => {
      const res = run(repoWithChanges(changes), 'main');
      assert.equal(res.status, 1, res.stdout + res.stderr);
    });
  }

  it('--any-pkg-change fails on any pkg/ change and passes without one', () => {
    assert.equal(run(repoWithChanges({ 'pkg/services/x/x.go': 'package x\n' }), '--any-pkg-change', 'main').status, 1);
    assert.equal(run(repoWithChanges({ 'public/app/a.ts': 'export {};\n' }), '--any-pkg-change', 'main').status, 0);
  });

  it('exits 2 on an unknown ref', () => {
    assert.equal(run(repoWithChanges({}), 'does-not-exist').status, 2);
  });
});
