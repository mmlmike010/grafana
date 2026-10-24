# Grafana Desktop (Electron shell)

A thin Electron shell around the existing Grafana SPA. The shell's main process owns the window and, later, the
grafana-server process; the renderer is the unmodified SPA loaded over HTTP from `http://127.0.0.1:23300`. The
contract with the bundled server (pinned port, bind address, config, health states) is
[`docs/server-contract.md`](docs/server-contract.md).

## Install

`desktop/` is an independent Yarn project. It is **not** a root workspace and has its own `yarn.lock`, so it never
affects the root install.

```sh
yarn --cwd desktop install
```

The root `.yarnrc.yml` (`enableScripts: false`) also applies here, so Electron's postinstall download is skipped.
`yarn --cwd desktop dev` fetches the pinned Electron binary on first run (`yarn --cwd desktop electron:install`).
`lint`, `typecheck`, `build`, and `test` do not need the binary.

## Develop

1. Start Grafana from the repo root (`make run`, plus `yarn start` for the frontend). It must listen on
   `127.0.0.1:3000`.
2. Launch the shell:

   ```sh
   yarn --cwd desktop dev
   ```

   This bundles main and preload into `desktop/dist/` and opens one window on `http://127.0.0.1:3000`.

Unpackaged (dev) runs target an already-running local grafana-server: `127.0.0.1:3000` by default, or another port via
`GRAFANA_DESKTOP_DEV_PORT` (for example `GRAFANA_DESKTOP_DEV_PORT=3001 yarn --cwd desktop dev`). Packaged builds
ignore the override and always load the pinned origin `http://127.0.0.1:23300`.

| Script                                  | What it does                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `yarn --cwd desktop build`              | esbuild bundles `src/main` and `src/preload` into `dist/` and enforces the preload size budget |
| `yarn --cwd desktop dev`                | `build`, then launch Electron against the local dev grafana-server                             |
| `yarn --cwd desktop lint`               | ESLint plus the preload import allowlist check                                                 |
| `yarn --cwd desktop typecheck`          | `tsc` for main (`tsconfig.json`, no DOM lib) and preload (`tsconfig.preload.json`)             |
| `yarn --cwd desktop test`               | Fixture tests for the desktop guards                                                           |
| `yarn --cwd desktop test:root-boundary` | Fixture tests for the root ESLint boundary rules (needs the root `yarn install`)               |

## Layout

```
desktop/
  src/main/      Electron main process (Node). App lifecycle and the BrowserWindow.
  src/preload/   Sandboxed preload. The only place raw ipcRenderer is allowed.
  src/shared/    The one shared folder for main and preload: origin constants (origin.ts), the IPC channel
                 allowlist (ipc-channels.ts), and the typed server contract (server-contract.ts, from CUR-28).
  resources/     electron-builder buildResources (icon.icns, icon.ico, icons/<size>.png, background.png).
  scripts/       Build and guard scripts.
  electron-builder.yml  Minimal packaging config (packaging itself is a later ticket); output goes to release/.
```

Grafana already uses "renderer" (the image renderer plugin) and "preload" (the plugin preloader) for unrelated
things. In this package those words always mean the Electron renderer and preload.

## Architecture rules

- **Main versus renderer.** The renderer is the Grafana SPA and stays on the paint path (about 16 ms a frame). It
  does no heavy compute or I/O, and neither does the preload. Anything heavy or blocking belongs in main.
- **The SPA build is untouched.** The root webpack config stays `target: 'web'`. Never use
  `target: 'electron-renderer'`. Code under `public/` and `packages/` may not import `electron` or Node builtins
  (`fs`, `child_process`, `path`, `os`, `net`, `node:*`). The root ESLint config enforces this.
- **One origin.** Packaged builds load exactly `http://127.0.0.1:23300`, never `localhost`. The pinned origin is one
  constant, `PINNED_GRAFANA_ORIGIN` in [`src/shared/origin.ts`](src/shared/origin.ts), and the port is owned by
  [`docs/server-contract.md`](docs/server-contract.md) (CUR-28). The dev override is a separate constant and only
  applies to unpackaged runs.
- **No fallback port.** If the port is unavailable or the override is invalid, the shell fails loudly. Nothing probes
  for another port.
- **Thin window.** The `BrowserWindow` uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- **IPC allowlist only.** Channel names live in `src/shared/ipc-channels.ts` (empty until IPC v0). Raw `ipcRenderer`
  is banned everywhere except `src/preload/`. The preload may import only `contextBridge` and `ipcRenderer` from
  `electron` plus `../shared/*` (`scripts/check-preload-imports.mjs`), and its bundle must stay under 16 KiB.
- **No desktop APIs in `pkg/`.** The Go server gets no desktop-specific files or routes. The desktop talks to the
  same HTTP API as the browser.

## Guard scripts

`scripts/check-no-pkg-desktop.sh` fails if a diff adds desktop surface to `pkg/`. By default it fails on desktop- or
electron-named paths and on added lines that mention `electron` or a `/desktop` route segment. With
`--any-pkg-change` it fails on any `pkg/` change, which is meant for desktop-labelled PRs.

```sh
desktop/scripts/check-no-pkg-desktop.sh [--any-pkg-change] [BASE_REF] [HEAD_REF]
# for example, in a PR job (needs the base fetched):
git fetch origin main && desktop/scripts/check-no-pkg-desktop.sh origin/main HEAD
```

Exit codes: `0` clean, `1` violation, `2` usage or git error.

## Root lint and prettier

The root `yarn lint` ignores `desktop/`, because desktop has its own dependencies and ESLint config; run
`yarn --cwd desktop lint` instead. The root boundary rules for `public/` and `packages/` still run in root lint. The
root `yarn prettier:check` does cover `desktop/` and uses the root `.prettierrc.js`.
