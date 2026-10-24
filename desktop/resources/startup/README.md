# Startup and failure page

A static page that Electron main shows while the bundled Grafana server starts, and when it can't. It's loaded before the SPA exists, so it has no React or `@grafana/ui` runtime. States and signals follow the server contract in `desktop/docs/server-contract.md` (CUR-28).

| File                             | Purpose                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `startup.html`                   | The page. One document for every state.                                                                               |
| `startup.css`                    | Layout and components. Every color comes from `theme-vars.css`.                                                       |
| `startup.js`                     | Reads the query string and shows the matching state. No network, Node, `require`, or IPC.                             |
| `theme-vars.css`                 | **Generated.** CSS custom properties from `GrafanaTheme2`. Don't edit by hand.                                        |
| `grafana_icon.svg`               | Unaltered copy of `public/img/grafana_icon.svg`.                                                                      |
| `scripts/generate-theme-vars.ts` | Writes `theme-vars.css` from `createTheme()` in `@grafana/data` and fails if any rendered text pair is below WCAG AA. |

## Loading the page

Load it with `loadFile` and a query string:

```js
win.loadFile(path.join(resourcesDir, 'startup', 'startup.html'), {
  query: { state: 'booting', theme: 'dark' },
});
```

| Param    | Values                                 | Used by       | Notes                                                                                                                       |
| -------- | -------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `booting` \| `failed` \| `port-in-use` | all           | Defaults to `booting`. `ready` isn't a screen: main loads `http://127.0.0.1:23300/` instead.                                |
| `theme`  | `light` \| `dark`                      | all           | The cached theme. Defaults to `dark` when missing or invalid.                                                               |
| `reason` | `exit` \| `timeout`                    | `failed`      | `exit`: the server exited before ready, or crashed after ready. `timeout`: the readiness timeout fired. Defaults to `exit`. |
| `code`   | integer exit code                      | `failed`      | With `reason=exit`. Shown in the details line.                                                                              |
| `signal` | `SIG…` name, for example `SIGKILL`     | `failed`      | With `reason=exit`, when there's no exit code.                                                                              |
| `logs`   | absolute path to the logs folder       | `failed`      | `[paths] logs`, for example `<userData>/grafana/logs`. Shown as selectable monospace text. Hidden when missing.             |
| `detail` | the last stdout line from the server   | `failed`      | Muted, selectable monospace on one line. Capped at 200 characters with an ellipsis. Hidden when missing.                    |
| `port`   | digits only, `1`–`65535`               | `port-in-use` | Defaults to `23300`.                                                                                                        |

Main reloads the page only when the state changes. There's no live progress on `booting` and no hash contract: the booting screen is static apart from the note that appears after 10 s.

Every query string value is validated or written with `textContent`, never `innerHTML`, so a path or log line can't inject markup. The page loads from disk (`file://`), never from `127.0.0.1`, and references its assets with relative paths only.

## Window background color

The page background is `colors.background.canvas`. Set the `BrowserWindow` `backgroundColor` to the same value so there's no flash before the first paint, and before the SPA paints after `loadURL`:

| Theme | `backgroundColor` |
| ----- | ----------------- |
| Dark  | `#111217`         |
| Light | `#fbfbfb`         |

The generator prints both values, so recheck them after a theme change.

## Retry and Quit (no IPC)

The buttons are plain links to a custom scheme. Main intercepts them with `will-navigate` and cancels the navigation:

| Link                      | Shown on                | Main does                                                     |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| `grafana-desktop://retry` | `failed`, `port-in-use` | Go back to preflight: probe the port again, then spawn.       |
| `grafana-desktop://quit`  | `failed`, `port-in-use` | Quit the app, with the normal graceful shutdown of the child. |

```js
win.webContents.on('will-navigate', (event, url) => {
  if (url.startsWith('grafana-desktop://')) {
    event.preventDefault();
    if (url === 'grafana-desktop://retry') {
      retryStartup();
    } else if (url === 'grafana-desktop://quit') {
      app.quit();
    }
  }
});
```

Verified with Electron 45 (sandboxed, `contextIsolation: true`): mouse clicks and keyboard Enter on both links reach `will-navigate`, and `preventDefault()` keeps the page loaded.

Don't register `grafana-desktop` as an OS-level protocol handler. Links on this page only need to reach `will-navigate`, and an OS registration would let any website trigger them.

Main honors `grafana-desktop://retry` from both `failed` (either reason) and `port-in-use`, matching the `failed --> preflight: Retry` transition in the server contract. On `failed`, main kills the child first if it's still running.

## Copy

### `booting`

- Page title and headline: **Starting Grafana**
- Message: This usually takes a few seconds.
- After 10 s: The first launch can take a couple of minutes while the database is set up.
- Indeterminate progress bar. With `prefers-reduced-motion: reduce`, it's a static bar.

### `failed`, `reason=exit`

- Page title and headline: **Grafana stopped unexpectedly**
- Message: Something went wrong while Grafana was running. Try again, or check the logs folder for details.
- Logs folder: `<logs>`
- Details line: grafana-server exited with code `<code>`. (or signal `<signal>`; hidden when neither is passed)
- Last output (optional, from `detail`): the last stdout line, in monospace.
- Buttons: Retry (primary), Quit (secondary)

### `failed`, `reason=timeout`

- Page title and headline: **Grafana took too long to start**
- Message: Grafana didn't finish starting. Try again, or check the logs folder for details.
- Logs folder: `<logs>`
- Details line: grafana-server didn't report ready before the startup time limit.
- Last output (optional, from `detail`): the last stdout line, in monospace.
- Buttons: Retry (primary), Quit (secondary)

The timeout copy doesn't name a duration, because the limit is 30 s that resets on migration progress, with a 120 s hard cap.

### `port-in-use`

- Page title and headline: **Port 23300 is already in use**
- Message: Another copy of Grafana or a different app may be using it. Close that app, then select Retry.
- Details line: grafana-server needs 127.0.0.1:23300 to start.
- Buttons: Retry (primary), Quit (secondary)

## Regenerating `theme-vars.css`

Run from the repo root, after `yarn install`, because the script bundles `@grafana/data` from source:

```sh
npx esbuild --target=es6 ./desktop/resources/startup/scripts/generate-theme-vars.ts --bundle \
  --conditions=@grafana-app/source --platform=node --tsconfig=./scripts/cli/tsconfig.json | node
```

This mirrors the root `themes-generate` script. It prints the contrast ratio of each text/background pair the page renders, and exits with an error if any pair is below 4.5:1.

One deliberate difference from `@grafana/ui`: the primary Button hover uses `primary.shade`, which is 3.56:1 against white text in the dark theme. The generator emits `--gf-color-primary-hover` as `primary.shade` only when it passes AA and falls back to `primary.main` otherwise. Today that means dark hover keeps `primary.main` and light hover uses the shade.

## Fonts and security

- Fonts come from the theme's stack (`'Inter', 'Helvetica', 'Arial', sans-serif` and `'Roboto Mono', monospace`). Nothing is downloaded: Inter is used if it's installed locally, otherwise the system falls back to Helvetica or Arial.
- The page sets a CSP of `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'`. It makes no network requests and has no inline script or style.
