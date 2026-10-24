# Grafana Desktop: session and logout contract

Status: **draft for Full Stack sign-off** (CUR-44). Owner: Full Stack. Implementer: Electron. Consumers: hardened window (CUR-41), smoke definition, CI-4.

This is the contract for how the desktop shell keeps the user logged in and how it logs them out. The window is a `BrowserWindow` at `http://127.0.0.1:23300` (see [`server-contract.md`](./server-contract.md), CUR-28). **There are no `pkg/` or `public/` changes and no new IPC channels.**

Source links point at `main`. Line numbers were verified at commit `e7b95c6dd5`. Electron behavior described here is from the Electron and Chromium APIs, not from running a build; the smoke checks in section 6 are what confirm it.

## 1. Locked decisions

| Area      | Decision                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Partition | Persistent Electron partition `persist:grafana`, set by the hardened window (CUR-41). Login survives an app restart, like a browser.            |
| Auth      | The SPA's normal Grafana cookie session (`grafana_session`). **No IPC auth, no token vault, no new endpoint.**                                  |
| Logout    | The SPA navigates to `/logout` as usual. Main then clears the partition with `session.fromPartition('persist:grafana').clearStorageData()`.     |
| Scope     | Cookies, localStorage, IndexedDB, and caches in the partition. Section 4 amends **when** the clear runs and adds `clearCache()`; see section 9. |

## 2. How Grafana logout works (verified)

### 2.1 Frontend trigger: a full-page navigation

- The only sign-out control is the profile menu's **Sign out** item: a `MenuItem` with `url={appSubUrl + '/logout'}` and `target="_self"` ([`ProfileButton.tsx#L51-L58`][fe-signout]). It's hidden when `[auth] disable_signout_menu = true` ([`defaults.ini#L657`][ini-disable-signout]).
- `MenuItem` renders a plain `<a href>` when `url` is set ([`MenuItem.tsx#L117`][fe-menuitem-a], [`#L186-L197`][fe-menuitem-href]). It isn't a router `Link` and has no fetch. **Clicking it is a renderer-initiated, main-frame, cross-document navigation to `GET /logout`.**
- Session expiry is a different path. When the session is gone (a 401 from rotation or a failed login ping), the SPA calls `contextSrv.setLoggedOut()`, which does `window.location.reload()` ([`context_srv.ts#L122-L128`][fe-setloggedout], [`#L250-L267`][fe-rotate-job], [`backend_srv.ts#L500-L530`][fe-401]). **That path never touches `/logout`.**

### 2.2 Server: revoke, delete cookies, redirect

`GET /logout` is registered with no auth requirement ([`api.go#L83`][route-logout]). The handler is [`HTTPServer.Logout`, `login.go#L287-L307`][logout-handler]:

1. **SAML single logout** (Enterprise only): if the user signed in with SAML and SLO is enabled, the handler redirects to `/logout/saml` and returns ([`login.go#L289-L294`][logout-saml]). OSS doesn't register that route.
2. **`authnService.Logout`** ([`service.go#L309-L363`][authn-logout]):
   - The default redirect is `<AppSubURL>/login`, replaced by `[auth] signout_redirect_url` if that's set ([`#L313-L316`][authn-default-redirect], [`setting.go#L1980`][set-signout]).
   - **If the request isn't from a signed-in user, it returns right away without revoking anything** ([`#L318-L320`][authn-early-return]). In the window, the user is identified only by the `grafana_session` cookie ([`session.go#L46-L64`][session-client]).
   - It runs pre-logout hooks, then the auth module's logout client. For OAuth, that invalidates the stored OAuth tokens and returns the provider's `signout_redirect_url` (per provider, falling back to `[auth]`). It adds `id_token_hint` when the URL has `post_logout_redirect_uri` ([`oauth.go#L298-L337`][oauth-logout], [`#L377-L383`][oauth-signout-url], [`#L402-L415`][oauth-oidc]).
   - It **hard-deletes** the session row: `RevokeToken(ctx, sessionToken, false)` ([`#L357-L360`][authn-revoke]). `soft=false` runs `DELETE`, not `revoked_at = now` ([`auth_token.go#L401-L451`][revoke], [`#L424-L429`][revoke-delete]). A missing row (`ErrUserTokenNotFound`) is ignored.
3. **`DeleteSessionCookie` always runs** ([`login.go#L297`][logout-delete-cookie]). It writes `grafana_session` and `grafana_session_expiry` with `MaxAge: -1` ([`authn.go#L347-L354`][delete-cookie]), which Go sends as `Max-Age=0` ([`cookies.go#L32-L34`][cookies-delete]).
4. **Redirect**: `302 Found` ([`web/context.go#L129-L136`][web-redirect]) to `redirect.URL`. On error it still redirects to `/login` ([`login.go#L299-L306`][logout-error]).

Consequences for desktop:

- **`/logout` always answers with a 302.** It never renders a page, so the window never commits a navigation whose URL is `/logout`.
- **Revocation depends on the `/logout` request carrying `grafana_session`.** Without it, the server still deletes cookies and redirects, but the row in `user_auth_token` stays valid.
- **The final page is `/login` by default.** With `signout_redirect_url` (global or OAuth provider), it's that URL, typically an **off-origin IdP end-session endpoint**. With SAML SLO, it's `/logout/saml` then the IdP.
- The `Successful Logout` log line ([`login.go#L305`][logout-log]) is also printed for a cookieless `/logout` that revoked nothing. **It isn't proof of revocation.**

## 3. Why the `will-navigate` design fails

The ticket's draft clears storage when the window navigates to `<origin>/logout` (`will-navigate` or `did-navigate`). Neither hook works as written:

- **`will-navigate` fires before the request is sent.** If main clears the partition there, the `/logout` request goes out without `grafana_session`. The server takes the early return in section 2.2 and **never deletes the token**. The token stays valid server-side until it expires (7 days idle or 30 days total, section 5). `clearStorageData()` is async, so without an `await` the outcome is also a race: some runs revoke and some don't.
- **`did-navigate` never reports `/logout`.** It fires once per committed main-frame navigation, with the final URL after redirects. For logout that's `/login` or the IdP page. A matcher on `did-navigate` to `/logout` never fires.
- **`will-navigate` misses main-initiated loads.** It doesn't fire for `webContents.loadURL()`, so a future app-menu Sign out that calls `loadURL('/logout')` would bypass it.
- **`session.webRequest.onCompleted` filtered on `/logout` doesn't fire either.** In Chromium's webRequest lifecycle, which Electron mirrors, a redirected request gets `onBeforeRedirect`, and only the final request in the chain gets `onCompleted`. `onBeforeRedirect` would work as a signal, but it can't cancel or delay the redirect, so `/login` races the clear. Electron also allows **one listener per webRequest event per session**, and CUR-41 may already use those listeners.

## 4. Logout hook (recommended)

**Detect with `did-start-navigation`, clear on `will-redirect` out of `/logout`.** At `will-redirect`, Grafana has already sent the `/logout` response, so the token row is already deleted. The handler revokes before it writes the 302.

### 4.1 Algorithm

1. **`did-start-navigation`** (main frame, not same-document): if the URL is `ORIGIN + '/logout'`, set `logoutInFlight = true`. This catches link clicks and `loadURL()` alike.
2. **`will-redirect`** while `logoutInFlight`:
   - **Same-origin target other than `/logout/saml`** (the default `/login`): call `event.preventDefault()`, `await clearPartition()`, then `loadURL(target)`. The login page boots on an empty partition, with no double load and no race.
   - **Off-origin target (IdP) or `/logout/saml`**: let the redirect continue. The IdP needs its own cookies in the partition to end its session. Clear at step 3.
3. **Terminal event of the chain** while `logoutInFlight` (the first main-frame `did-navigate`, `did-fail-load`, or `did-fail-provisional-load`): `await clearPartition()`.
   - If the committed page is on `ORIGIN` (the IdP sent the user back to `/login`), `reload()` so the login page boots on an empty partition.
   - If the committed page is off-origin (the IdP's "signed out" page), leave it, because it may need a click. Then re-write the `logout-pending` marker (section 4.2) and arm a one-shot clear: on the next `will-navigate` or `will-redirect` back into `ORIGIN`, `preventDefault()`, `await clearPartition()`, and `loadURL()` the target. This drops anything the IdP page stored after the first clear. If the app quits first, the marker runs the clear at the next launch.
4. Reset `logoutInFlight` after step 2's same-origin branch or after step 3.

**Recommended IdP config:** include `post_logout_redirect_uri=http://127.0.0.1:23300/login` in `signout_redirect_url`, so the chain ends on-origin in one pass. Grafana also adds `id_token_hint` only when that parameter is present ([`oauth.go#L330-L334`][oauth-hint]).

### 4.2 `clearPartition()`

```ts
async function clearPartition(): Promise<void> {
  writeMarkerSync(path.join(app.getPath('userData'), 'logout-pending')); // fsync before clearing
  const ses = session.fromPartition('persist:grafana');
  await ses.clearStorageData(); // cookies, localStorage, IndexedDB, CacheStorage, service workers, ...
  await ses.clearCache(); // HTTP disk cache; clearStorageData() doesn't touch it
  await ses.cookies.flushStore();
  ses.flushStorageData();
  removeMarker(); // only after every step above resolved
}
```

- One in-flight promise, shared: a second call while one is running awaits the first.
- On launch, if `logout-pending` exists, `await clearPartition()` **before** the window loads the SPA.
- `sessionStorage` isn't in `clearStorageData()`. It lives in memory per tab and survives same-tab navigations, so a stale `redirectTo` entry can outlive logout until the app quits. That's low risk, and it's an open question.

### 4.3 Sketch (illustrative)

The exact event signatures depend on the Electron version pinned in CUR-36.

```ts
const ORIGIN = 'http://127.0.0.1:23300';
let logoutInFlight = false;

wc.on('did-start-navigation', (e) => {
  if (!e.isMainFrame || e.isSameDocument) return;
  const u = new URL(e.url);
  if (u.origin === ORIGIN && u.pathname === '/logout') logoutInFlight = true;
});

wc.on('will-redirect', (e) => {
  if (!logoutInFlight || !e.isMainFrame) return;
  const to = new URL(e.url);
  if (to.origin === ORIGIN && to.pathname !== '/logout/saml') {
    e.preventDefault();
    logoutInFlight = false;
    clearPartition().finally(() => wc.loadURL(to.href));
  }
});

const endChain = async () => {
  if (!logoutInFlight) return;
  logoutInFlight = false;
  await clearPartition();
  if (new URL(wc.getURL()).origin === ORIGIN) wc.reload();
  else armReturnClear(); // re-writes the marker; clears again on the next navigation into ORIGIN
};
wc.on('did-navigate', endChain);
wc.on('did-fail-provisional-load', (_e, _code, _desc, _url, isMainFrame) => isMainFrame && endChain());
```

## 5. Session-lifetime settings

There's **no remember-me option** in Grafana's login form or `POST /login` handler. Persistence comes entirely from the cookie and the token lifetimes below.

| Setting ([`defaults.ini#L637-L660`][ini-auth])                           | Default                    | Affects restart survival? | Why                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login_maximum_inactive_lifetime_duration` ([L645][ini-inactive])        | `7d` ([setting][set-7d])   | **Yes**                   | A token whose `rotated_at` is older than this is expired at lookup ([`auth_token.go#L175-L181`][lookup-expired], [`#L676-L678`][rotated-after]). Rotation only happens while the SPA is open, so **an app left closed for more than 7 days opens on `/login`**.                                                                    |
| `login_maximum_lifetime_duration` ([L648][ini-max])                      | `30d` ([setting][set-30d]) | **Yes**                   | Hard cap from `created_at` ([`#L672-L674`][created-after]). It's also the cookie's `Max-Age` ([`authn.go#L332-L345`][write-cookie]), which makes `grafana_session` a **persistent** cookie that Chromium writes to disk. Don't set it to `0`: that makes the cookie `Max-Age=0`, so login can't stick at all.                      |
| `token_rotation_interval_minutes` ([L651][ini-rotation])                 | `10` (minimum 2)           | No                        | The SPA rotates about every 10 min ([`context_srv.ts#L201-L223`][fe-rotate-schedule]). After a restart longer than that, the first page load is a `302` to `/user/auth-tokens/rotate`, which rotates and redirects back ([`middleware/auth.go#L51-L60`][mw-rotate], [`user_token.go#L78-L97`][rotate-redirect]). This is expected. |
| `POST /api/user/auth-tokens/rotate` ([`api.go#L269-L270`][route-rotate]) | n/a                        | Indirectly                | It resets `rotated_at`, and therefore the 7-day idle window ([`user_token.go#L110-L150`][rotate-api], [`auth_token.go#L290-L399`][rotate-token]). A crash can lose the last rotated cookie, but the server accepts `prev_auth_token` too ([`#L150`][lookup-prev]), so one missed rotation doesn't log the user out.                |
| `login_cookie_name` ([L639][ini-cookie-name])                            | `grafana_session`          | Yes, if changed           | Renaming it between app versions logs everyone out.                                                                                                                                                                                                                                                                                |
| `[security] secret_key` (server contract 3.4)                            | generated once             | Yes, if changed           | Session tokens are hashed with it ([`auth_token.go#L689-L692`][hash-token]). Rotating it invalidates every session, in addition to data source secrets.                                                                                                                                                                            |
| `[security] cookie_secure` (server contract 3.4)                         | `false`                    | Yes, if changed           | `true` on the plain-`http` origin means Chromium drops the cookie, so login doesn't work.                                                                                                                                                                                                                                          |

**Recommended desktop defaults: don't set any of these.** Keep the upstream defaults (7 d idle, 30 d max, 10 min rotation) and leave them out of the generated `custom.ini`, so they track upstream. Whether 7 days idle is too short for an intermittently used desktop app is a product question (section 9).

## 6. Acceptance checks (CI smoke)

Each check runs against a fresh `userData` directory, drives the app with Playwright's Electron support, and reads the partition from main through `session.fromPartition('persist:grafana')`. `ORIGIN` is `http://127.0.0.1:23300`. Log in through the login form so the cookie lands in the partition. The test process may read cookie values; production code never does.

### C1: login survives a restart

1. Launch, wait for `ready` (server contract section 5), log in.
2. **Pass:** `cookies.get({ url: ORIGIN, name: 'grafana_session' })` returns one cookie with `session === false` and an `expirationDate` about 30 days from now.
3. In the window, `fetch('/api/user/auth-tokens')` and record the `id` of the entry with `isActive: true` as `T` ([`user_token.go#L194-L198`][tokens-active]).
4. Quit with `app.quit()` and wait for the process to exit. Relaunch with the same `userData`.
5. **Pass:** the main frame's final URL path isn't `/login` (an intermediate `/user/auth-tokens/rotate` hop is allowed), and `fetch('/api/user')` in the window returns 200 with the same login.
6. **Variant C1-crash:** same, but `SIGKILL` the Electron process at step 4. **Pass:** same as step 5.

### C2: the partition is empty after logout

1. Logged in. In the window, set `localStorage.setItem('desktop-smoke', '1')` and create an IndexedDB database named `desktop-smoke`. Record the `grafana_session` value as `V`.
2. Click the profile menu, then **Sign out**.
3. Wait for the main frame's URL path to be `/login` and for the `logout-pending` marker to be gone.
4. **Pass, all of:**
   - `cookies.get({})` returns `[]`. If the login page turns out to set a cookie of its own, allowlist it by name. `grafana_session` and `grafana_session_expiry` must never be present.
   - In the `/login` page: `localStorage.getItem('desktop-smoke') === null`, and `indexedDB.databases()` doesn't list `desktop-smoke`.
   - `caches.keys()` resolves to `[]`.
5. **Pass:** the `/logout` request was sent **with** `grafana_session`. Assert this through C4, not by watching requests, because a webRequest listener in the test could replace CUR-41's.

### C3: the next launch lands on login

1. After C2, quit and relaunch with the same `userData`.
2. **Pass:** the main frame's final URL path is `/login`, `fetch('/api/user')` returns 401, and `logout-pending` doesn't exist. Don't assert zero cookies here: the login page may set its own.

### C4: the server-side token is revoked

1. **Control (before logout):** from the test process with Node `http`, `GET ORIGIN/api/user` with `Cookie: grafana_session=V`. **Pass:** 200.
2. After C2 step 3, repeat the request. **Pass:** 401.
3. `GET ORIGIN/api/admin/users/1/auth-tokens` with basic auth as admin ([`api.go#L590`][route-admin-tokens]; basic auth is on by default, [`defaults.ini#L960-L961`][ini-basic]). **Pass:** no entry has `id === T`. That list only includes live tokens ([`auth_token.go#L561`][list-filter]).
4. Optional, against `<userData>/grafana/data/grafana.db` after quit: `SELECT COUNT(*) FROM user_auth_token WHERE id = T` returns `0`. **Assert that the row is gone, not `revoked_at > 0`**, because `/logout` hard-deletes ([`user_auth_token_mig.go#L8-L28`][token-table], section 2.2).

**C4 is the regression guard for section 3:** a clear on `will-navigate` passes C2 and C3 but fails C4 step 2.

### C5 (optional): idle expiry

Add `[auth] login_maximum_inactive_lifetime_duration = 1m` to the generated `custom.ini`. Log in, quit, wait 70 s, relaunch. **Pass:** lands on `/login`.

## 7. Edge cases

- **Server down when the user clicks Sign out.** `/logout` fails with `did-fail-provisional-load` (`ERR_CONNECTION_REFUSED`), and no redirect fires. Section 4.1 step 3 still clears, because the user asked to log out. The token row stays valid until it expires (7 d idle), but nothing holds it anymore: the cookie is gone and the server only binds `127.0.0.1`. Log `session.logout_unrevoked` in main. Main's server process manager owns the `failed` screen.
- **Offline with an IdP signout URL.** Grafana already revoked and redirected. The IdP hop fails, which is the chain's terminal event, so the partition is cleared, then `loadURL(ORIGIN + '/login')`. The IdP session stays open at the IdP, but its cookies are gone from the partition, so the next OAuth login asks for credentials again.
- **Crash or kill mid-clear.** The marker is written before clearing and removed only after the flushes, so the next launch finishes the clear before loading the SPA. Because the clear runs after the `/logout` response, a half-cleared partition only holds a dead cookie (C4 returns 401).
- **Crash before the `/logout` response.** Nothing is cleared and the token is still valid. The user is still logged in on the next launch. That's correct: the logout didn't happen.
- **In-flight token rotation.** A `POST /api/user/auth-tokens/rotate` response landing after the clear could write a fresh `grafana_session` for a deleted token. Leaving the page for `/logout` cancels the SPA's in-flight fetches, so this should be rare. C2's cookie assertion would catch it.
- **OAuth `auto_login`.** `/login` redirects straight back to the IdP when auto-login is on ([`login.go#L132-L135`][login-autologin], [`#L215-L222`][try-autologin]). With the IdP cookies cleared, the user sees the IdP's login form, not a silent re-login. `?disableAutoLogin` skips it ([`login.go#L114-L119`][login-disable-auto]).
- **Session ends without `/logout`** (idle expiry, `ERR_TOKEN_REVOKED`, admin force logout). The SPA reloads and lands on `/login` through section 2.1's path. Main doesn't clear the partition. The stale cookie is rejected by the server.
- **Multiple windows.** v1 has one window. The partition is per session, not per window, so a clear logs every window out. Those windows get a 401 and reload to `/login`. If v2 adds windows, attach the section 4 listeners to every `webContents` in the partition (`app.on('web-contents-created')`). `clearPartition()` is already single-flight.

## 8. No `pkg/` or `public/` changes

Everything here uses the existing `/logout` route, existing cookies, existing settings, and Electron session APIs in main. No IPC channel is added.

## 9. Open questions

1. **Amend the ticket's hook (Full Stack sign-off).** Replace "clear on `will-navigate`/`did-navigate` to `/logout`" with section 4: detect on `did-start-navigation`, clear on `will-redirect` out of `/logout`, or on the chain's terminal event for IdP and SAML.
2. **Amend the clear set.** `clearStorageData()` doesn't clear the HTTP cache, so add `clearCache()`. `sessionStorage` isn't cleared: accept, or recreate the `webContents` on logout?
3. **CUR-41 navigation policy.** Does the hardened window allow off-origin redirects (IdP login and end-session) in-window? If IdP traffic goes to the system browser instead, section 4.1 step 2 always takes the same-origin branch and the IdP session isn't in the partition.
4. **Idle lifetime for desktop (Eng Manager).** Keep 7 days idle, or set something like `30d` for an app opened weekly? It's a trade-off against a stolen laptop with an open session.
5. **Clear on non-`/logout` session ends?** Currently no (section 7). Clearing on every `/login` landing would also wipe state on a first launch or an expiry.
6. **SAML.** `/logout/saml` is Enterprise-only. Confirm v1 ships OSS, or add an Enterprise smoke for the SAML branch.
7. **OAuth `auto_login`.** After logout, should main load `/login?disableAutoLogin` so the user sees Grafana's login page rather than the IdP's?

[fe-signout]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/components/AppChrome/TopBar/ProfileButton.tsx#L51-L58
[fe-menuitem-a]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-ui/src/components/Menu/MenuItem.tsx#L117
[fe-menuitem-href]: https://github.com/mmlmike010/grafana/blob/main/packages/grafana-ui/src/components/Menu/MenuItem.tsx#L186-L197
[fe-setloggedout]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/context_srv.ts#L122-L128
[fe-rotate-schedule]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/context_srv.ts#L201-L223
[fe-rotate-job]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/context_srv.ts#L250-L267
[fe-401]: https://github.com/mmlmike010/grafana/blob/main/public/app/core/services/backend_srv.ts#L500-L530
[route-logout]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/api.go#L83
[route-rotate]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/api.go#L269-L270
[route-admin-tokens]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/api.go#L590
[logout-handler]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L287-L307
[logout-saml]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L289-L294
[logout-delete-cookie]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L297
[logout-error]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L299-L306
[logout-log]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L305
[login-disable-auto]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L114-L119
[login-autologin]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L132-L135
[try-autologin]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/login.go#L215-L222
[rotate-redirect]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/user_token.go#L78-L97
[rotate-api]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/user_token.go#L110-L150
[tokens-active]: https://github.com/mmlmike010/grafana/blob/main/pkg/api/user_token.go#L194-L198
[authn-logout]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authnimpl/service.go#L309-L363
[authn-default-redirect]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authnimpl/service.go#L313-L316
[authn-early-return]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authnimpl/service.go#L318-L320
[authn-revoke]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authnimpl/service.go#L357-L360
[session-client]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/clients/session.go#L46-L64
[oauth-logout]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/clients/oauth.go#L298-L337
[oauth-hint]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/clients/oauth.go#L330-L334
[oauth-signout-url]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/clients/oauth.go#L377-L383
[oauth-oidc]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/clients/oauth.go#L402-L415
[write-cookie]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authn.go#L332-L345
[delete-cookie]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/authn/authn.go#L347-L354
[cookies-delete]: https://github.com/mmlmike010/grafana/blob/main/pkg/middleware/cookies/cookies.go#L32-L34
[web-redirect]: https://github.com/mmlmike010/grafana/blob/main/pkg/web/context.go#L129-L136
[mw-rotate]: https://github.com/mmlmike010/grafana/blob/main/pkg/middleware/auth.go#L51-L60
[lookup-prev]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L150
[lookup-expired]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L175-L181
[rotate-token]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L290-L399
[revoke]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L401-L451
[revoke-delete]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L424-L429
[list-filter]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L561
[created-after]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L672-L674
[rotated-after]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L676-L678
[hash-token]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/auth/authimpl/auth_token.go#L689-L692
[token-table]: https://github.com/mmlmike010/grafana/blob/main/pkg/services/sqlstore/migrations/user_auth_token_mig.go#L8-L28
[set-7d]: https://github.com/mmlmike010/grafana/blob/main/pkg/setting/setting.go#L1944-L1949
[set-30d]: https://github.com/mmlmike010/grafana/blob/main/pkg/setting/setting.go#L1953-L1958
[set-signout]: https://github.com/mmlmike010/grafana/blob/main/pkg/setting/setting.go#L1980
[ini-auth]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L637-L660
[ini-cookie-name]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L639
[ini-inactive]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L645
[ini-max]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L648
[ini-rotation]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L651
[ini-disable-signout]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L657
[ini-basic]: https://github.com/mmlmike010/grafana/blob/main/conf/defaults.ini#L960-L961
