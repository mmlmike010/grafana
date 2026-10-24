# Grafana Desktop: theme sync

Status: **draft, pending Electron review** (CUR-29). Owner: Designer. Consumers: preload, window lifecycle (`backgroundColor`), startup/failure page.

Depends on [`server-contract.md`](./server-contract.md) section 9 (theme signal) and section 10 (startup page), from CUR-28, and on the startup page in `desktop/resources/startup/` (CUR-37).

Source links point at `main`. Line numbers were verified at commit `e7b95c6dd5`.

## Summary

Three surfaces show a theme: the SPA, the native window background (seen before first paint and while resizing), and the native titlebar.

| Surface                  | Driven by                                                | v1 rule                                                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------- |
| SPA                      | The Grafana user/team/org theme preference               | Grafana preference wins. Desktop doesn't change it.           |
| Window `backgroundColor` | The cached `'light' \| 'dark'` value reported by preload | `colors.background.canvas` for the cached theme (section 2)   |
| Startup/failure page     | The cached value, passed as the `theme` query param      | Same tokens as the SPA, from generated `theme-vars.css`       |
| Native titlebar          | The OS appearance                                        | Follows the OS. **Main never sets `nativeTheme.themeSource`** |

Main never fetches user preferences from the API. It learns the theme only from what the SPA has already rendered.

## 1. Signal: preload reports the rendered theme

### 1.1 What preload reads

The SPA's theme stylesheet `<link>` in `<head>`. Its `href` contains `build/grafana.dark` or `build/grafana.light` (the full name carries a content hash).

- **Explicit `light`/`dark` preference:** the server renders the link in `<head>` ([`index.html#L25-L29`][index-head-link]).
- **`system` preference:** the inline boot script appends the link to `<head>` from `prefers-color-scheme` ([`index.html#L286-L304`][index-system]). It runs while the document parses, before `DOMContentLoaded`.
- **Live change:** [`changeTheme`][change-theme] inserts the new link at the top of `<head>` and removes the old one after the new CSS loads ([`theme.ts#L17-L36`][theme-swap]). It finds the old link by the same `build/grafana.<mode>` substring ([`theme.ts#L27`][theme-link]).

### 1.2 How preload reads it

1. **Once at `DOMContentLoaded`**, resolve the mode from the last `link[href*="build/grafana.dark"]` or `link[href*="build/grafana.light"]` in `<head>`.
2. **Then a `MutationObserver` on `<head>`** (`childList: true`) re-resolves on every mutation. Both links briefly coexist during a swap. Resolving again after the old link is removed settles on the new mode.
3. **Debounce:** preload sends only when the resolved mode differs from the last value it sent in this page load. Main also ignores a value equal to its cache, so repeated identical values never cause a write or a repaint.
4. If no theme link matches, preload sends nothing.

Preload only observes when `location.origin` is the Grafana origin (`resolveGrafanaOrigin()` in `desktop/src/shared/origin.ts`). It's a no-op on the `file://` startup page.

### 1.3 Channel

- **One allowlisted, one-way channel.** Preload calls `ipcRenderer.send(<theme channel>, 'light' | 'dark')`, exposed through `contextBridge` as a single function. No reply, no `invoke`. The channel name goes in `desktop/src/shared/ipc-channels.ts` next to `getAppInfo` (IPC v0).
- **Main validates every message** with the same sender, frame, and origin check as `getAppInfo`:
  - `event.sender` is the main window's `webContents`.
  - `event.senderFrame` is that `webContents`' main frame, not a subframe. A dashboard HTML panel or plugin iframe can't report a theme.
  - `new URL(event.senderFrame.url).origin` equals `resolveGrafanaOrigin()`.
  - The payload is exactly the string `'light'` or `'dark'`. Anything else is dropped.
- **Main caches the value in `userData`** (location is an open question, section 5) and uses it for `backgroundColor` and the startup page's `theme` param. It has no other effect.

### 1.4 Ruled out

| Not allowed                               | Why                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Any change under `public/`                | The link is already a stable surface. CI-4 asserts on its `href` (server contract section 9).          |
| Boot data (`window.grafanaBootData`)      | Internal SPA state with no compatibility promise, and it isn't updated by a live change.               |
| `webContents.executeJavaScript` from main | Main would run code in the SPA's world. The signal must flow one way, from preload.                    |
| Any read at quit                          | Unreliable during shutdown, and the cache is already current from live reports.                        |
| A main-side fetch of preferences          | Main would need the user's session, and would duplicate Grafana's user/team/org preference resolution. |

### 1.5 Why not the `<body>` class

Rejected (finding from [PR #103][pr-103], server contract section 9):

- **It doesn't change on a live toggle.** `changeTheme` swaps the stylesheet link and publishes `ThemeChangedEvent`, but never touches `document.body.classList` ([`theme.ts#L9-L51`][change-theme]).
- **With the `system` preference it can carry both classes.** The server renders `theme-dark` because `system` has `Type: "dark"`. The boot script then adds `theme-light` on a light OS without removing `theme-dark` ([`index.html#L43`][index-body], [`index.html#L286-L304`][index-system]).

## 2. Token to hex

`backgroundColor` is `colors.background.canvas` of `GrafanaTheme2` for the cached mode.

| Mode  | Token                      | Palette value                                                                                          | Hex       |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| Dark  | `colors.background.canvas` | `palette.gray05` ([`createColors.ts#L171`][dark-canvas], class `DarkColors` at [L118][dark-class])     | `#111217` |
| Light | `colors.background.canvas` | `palette.gray100` ([`createColors.ts#L256`][light-canvas], class `LightColors` at [L200][light-class]) | `#fbfbfb` |

Palette: `gray05: '#111217'` ([`palette.ts#L5`][palette-gray05]) and `gray100: '#fbfbfb'` ([`palette.ts#L24`][palette-gray100]), both in `packages/grafana-data/src/themes/`.

The startup page uses the same values. Its `theme-vars.css` is generated from `createTheme()` in `@grafana/data` by `desktop/resources/startup/scripts/generate-theme-vars.ts`, which emits `--gf-color-background-canvas` as `#111217` (dark) and `#fbfbfb` (light) and prints both `backgroundColor` values on every run. If the palette changes, regenerate `theme-vars.css` and update this table together.

## 3. Titlebar: follows the OS

**Main never sets `nativeTheme.themeSource` in v1.** It stays at its default, `'system'`, so the native titlebar follows the OS appearance, as the ticket specifies.

**Why main can't pin it to the Grafana theme:** `themeSource` doesn't only theme native chrome. It also overrides `prefers-color-scheme` in every renderer. Grafana's `system` preference resolves from that media query ([`registry.ts#L102-L106`][registry-system], [`index.html#L286-L304`][index-system]). Pinning `themeSource` to the cached value would feed the cache back into the SPA, and a `system` user would be stuck on whatever theme was cached, regardless of their OS.

The cached value drives only `backgroundColor` and the startup page's `theme` param.

Platform behavior with `themeSource = 'system'`:

| Platform   | Titlebar                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| macOS      | The native titlebar (and any vibrancy) follows System Settings > Appearance, including Auto, and updates live.    |
| Windows 11 | Electron applies the dark or light titlebar from the Windows app mode ("Choose your app mode"), and updates live. |
| Linux      | Decided by the window manager and GTK theme. Electron's appearance hints may be ignored. Accepted.                |

### Known v1 gap

When a user's explicit Grafana preference differs from the OS (for example Grafana `dark` on a light OS), the titlebar won't match the app. A light titlebar over a dark Grafana looks off, but it's accepted for v1 because the alternative breaks `system` users.

**Possible v1.1 fix:** preload also reports whether the preference is explicit (`light`/`dark`) or `system`. Main pins `themeSource` to the reported mode only for an explicit preference, and resets it to `'system'` otherwise. That's safe because an explicit preference doesn't read `prefers-color-scheme`. It needs a channel payload change (section 1.3) and an Electron sign-off. Note that the link `href` alone can't tell the two cases apart, so the extra signal needs its own source and CI coverage.

## 4. Behavior

"Cache" is the persisted `'light' | 'dark'` value from section 1.3. "OS mode" is `nativeTheme.shouldUseDarkColors`, which reflects the OS because `themeSource` is always `'system'`.

| Event                                                | Window `backgroundColor`                                                              | Startup page `theme`         | Titlebar | Cache                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| First launch (no cache)                              | From OS mode: `#111217` if dark, `#fbfbfb` if light                                   | From OS mode                 | OS       | Written by the first report after the SPA loads.                                                                   |
| Preference change in the SPA                         | Unchanged until the next window creation (live update is an open question, section 5) | Next load uses the new value | OS       | Updated from preload's live report.                                                                                |
| OS appearance change, cache empty                    | Not updated live. The next window creation reads the new OS mode.                     | New OS mode                  | OS, live | Still empty.                                                                                                       |
| OS appearance change, cache set, explicit preference | No change                                                                             | No change                    | OS, live | No change. The Grafana preference wins.                                                                            |
| OS appearance change, cache set, `system` preference | No change yet                                                                         | No change yet                | OS, live | Updated on the next SPA page load (see note).                                                                      |
| Logout                                               | No change                                                                             | No change                    | OS       | **Kept.** It's a display preference, not session data, so clearing the `persist:grafana` session doesn't touch it. |
| A different user logs in                             | Previous value until the next window creation                                         | Previous value               | OS       | Replaced by the new user's rendered theme on their first page load.                                                |
| Restart                                              | From cache                                                                            | From cache                   | OS       | Unchanged until the next report.                                                                                   |
| Startup/failure page                                 | From cache, or OS mode when empty                                                     | Always passed by main        | OS       | Not written: preload doesn't observe on `file://`.                                                                 |

Notes:

- **`system` preference and OS changes.** Grafana resolves `system` once, at boot, and doesn't react to later OS changes ("Do not react to changes in system theme after startup", [`index.html#L286-L287`][index-system]; [`registry.ts#L102-L106`][registry-system] reads `.matches` once). So the SPA re-renders, and preload reports the new mode, only on the next page load or when the user re-selects a theme. The titlebar changes immediately, because it follows the OS.
- **Login page after logout.** The login page is part of the SPA, so preload reports whatever theme it renders. For an anonymous visitor that's the server or org default, not the previous user's preference, and it replaces the cache. That's the theme the next launch paints first, so `backgroundColor` still matches.
- **Main always passes `theme` to the startup page.** The page falls back to `dark` when the param is missing, which would be wrong on a light OS with an empty cache.

## 5. Open questions for Electron

1. **`setBackgroundColor` on a live change.** Should main call `win.setBackgroundColor()` when a new value arrives, or only apply it at window creation? A stale background shows up as a flash of the wrong color when resizing until the next launch. Updating it live risks a visible repaint on some platforms. Recommendation: update live, and verify on all three platforms that no flash occurs.
2. **Clamping the debounce.** Preload already sends only on change. Should main also rate-limit (for example ignore more than one change per second, or write the cache with a trailing delay) to guard against a misbehaving page toggling rapidly, or is change-only enough?
3. **Where the cache lives.** Options: a small JSON file under `app.getPath('userData')` (for example `desktop-state.json`), shared with other window state such as bounds, or a dedicated `theme.json`. It must not live in the `persist:grafana` partition, because logout clears that. It has to be readable synchronously before the first `BrowserWindow` is created.

[pr-103]: https://github.com/mmlmike010/grafana/pull/103
[index-head-link]: https://github.com/mmlmike010/grafana/blob/main/public/views/index.html#L25-L29
[index-body]: https://github.com/mmlmike010/grafana/blob/main/public/views/index.html#L43
[index-system]: https://github.com/mmlmike010/grafana/blob/main/public/views/index.html#L286-L304
[change-theme]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/theme.ts#L9-L51
[theme-swap]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/theme.ts#L17-L36
[theme-link]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/theme.ts#L27
[registry-system]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/registry.ts#L102-L106
[dark-class]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/createColors.ts#L118
[dark-canvas]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/createColors.ts#L171
[light-class]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/createColors.ts#L200
[light-canvas]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/createColors.ts#L256
[palette-gray05]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/palette.ts#L5
[palette-gray100]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-data/src/themes/palette.ts#L24
