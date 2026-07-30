import * as runtime from '@grafana/runtime';

import { trackPluginInstallDeflected } from './tracking';

describe('plugin admin tracking', () => {
  it('reports install deflection with catalog metadata', () => {
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    trackPluginInstallDeflected({
      plugin_id: 'test-plugin',
      plugin_type: 'panel',
      path: '/plugins/test-plugin',
      readiness_status: 'blocked',
      readiness_reason: 'incompatible',
      plugin_status: 'INSTALL',
      latest_compatible_version: '2.0.0',
      grafana_dependency: '>=10.0.0',
    });

    expect(reportInteractionSpy).toHaveBeenCalledWith('grafana_plugin_install_deflected', {
      plugin_id: 'test-plugin',
      plugin_type: 'panel',
      path: '/plugins/test-plugin',
      readiness_status: 'blocked',
      readiness_reason: 'incompatible',
      plugin_status: 'INSTALL',
      latest_compatible_version: '2.0.0',
      grafana_dependency: '>=10.0.0',
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
  });
});
