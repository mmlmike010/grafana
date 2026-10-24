import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEV_GRAFANA_PORT_ENV, PINNED_GRAFANA_ORIGIN, resolveGrafanaOrigin } from '../src/shared/origin.ts';

describe('resolveGrafanaOrigin', () => {
  it('packaged builds always use the pinned origin and ignore the dev override', () => {
    assert.equal(PINNED_GRAFANA_ORIGIN, 'http://127.0.0.1:23300');
    assert.equal(resolveGrafanaOrigin({ isPackaged: true, env: {} }), PINNED_GRAFANA_ORIGIN);
    assert.equal(
      resolveGrafanaOrigin({ isPackaged: true, env: { [DEV_GRAFANA_PORT_ENV]: '3001' } }),
      PINNED_GRAFANA_ORIGIN
    );
  });

  it('dev builds target a local grafana-server on 127.0.0.1:3000 by default', () => {
    assert.equal(resolveGrafanaOrigin({ isPackaged: false, env: {} }), 'http://127.0.0.1:3000');
  });

  it('dev builds accept a port override and still use 127.0.0.1', () => {
    const env = { [DEV_GRAFANA_PORT_ENV]: '3001' };
    assert.equal(resolveGrafanaOrigin({ isPackaged: false, env }), 'http://127.0.0.1:3001');
  });

  for (const bad of ['abc', '0', '65536', '3000.5', '-1', ' 3000']) {
    it(`throws instead of falling back for ${JSON.stringify(bad)}`, () => {
      const env = { [DEV_GRAFANA_PORT_ENV]: bad };
      assert.throws(() => resolveGrafanaOrigin({ isPackaged: false, env }), /GRAFANA_DESKTOP_DEV_PORT/);
    });
  }
});
