// Where the shell loads Grafana from. Always 127.0.0.1, never `localhost`: `localhost` can resolve to ::1 and a
// different host string is a different origin (cookies, localStorage, OAuth redirect URIs).
// There is deliberately no fallback port anywhere: if the port is taken or invalid, fail loudly.

export const GRAFANA_HOST = '127.0.0.1';

// Production: the pinned origin the bundled grafana-server binds to (desktop/docs/server-contract.md).
// TODO(CUR-28): final pinned port; confirm when the server contract (PR #103) merges.
export const PINNED_GRAFANA_ORIGIN = 'http://127.0.0.1:23300';

// Development only (unpackaged builds): target an already-running local grafana-server. `make run` listens on 3000.
export const DEV_GRAFANA_PORT_ENV = 'GRAFANA_DESKTOP_DEV_PORT';
export const DEFAULT_DEV_GRAFANA_PORT = 3000;

export type Env = Readonly<Record<string, string | undefined>>;

function parseDevPort(env: Env): number {
  const raw = env[DEV_GRAFANA_PORT_ENV];
  if (raw === undefined || raw === '') {
    return DEFAULT_DEV_GRAFANA_PORT;
  }
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`${DEV_GRAFANA_PORT_ENV} must be an integer between 1 and 65535, got "${raw}"`);
  }
  return port;
}

export function resolveGrafanaOrigin({ isPackaged, env }: { isPackaged: boolean; env: Env }): string {
  if (isPackaged) {
    return PINNED_GRAFANA_ORIGIN;
  }
  return `http://${GRAFANA_HOST}:${parseDevPort(env)}`;
}
