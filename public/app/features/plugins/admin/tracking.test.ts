import * as runtime from '@grafana/runtime';

import { trackPluginInstallDeflected, trackPluginInstalled, trackPluginUninstalled } from './tracking';

describe('plugins/admin tracking', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports grafana_plugin_install_clicked', () => {
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    trackPluginInstalled({
      plugin_id: 'ace-svg-panel',
      plugin_type: 'panel',
      path: '/plugins/ace-svg-panel',
    });

    expect(reportInteractionSpy).toHaveBeenCalledWith('grafana_plugin_install_clicked', {
      plugin_id: 'ace-svg-panel',
      plugin_type: 'panel',
      path: '/plugins/ace-svg-panel',
    });
  });

  it('reports grafana_plugin_uninstall_clicked', () => {
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    trackPluginUninstalled({
      plugin_id: 'ace-svg-panel',
      path: '/plugins/ace-svg-panel',
    });

    expect(reportInteractionSpy).toHaveBeenCalledWith('grafana_plugin_uninstall_clicked', {
      plugin_id: 'ace-svg-panel',
      path: '/plugins/ace-svg-panel',
    });
  });

  it('reports grafana_plugin_install_deflected with the blocker reason', () => {
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    trackPluginInstallDeflected({
      plugin_id: 'ace-svg-panel',
      plugin_type: 'panel',
      path: '/plugins/ace-svg-panel',
      deflection_reason: 'no_compatible_version',
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });

    expect(reportInteractionSpy).toHaveBeenCalledWith('grafana_plugin_install_deflected', {
      plugin_id: 'ace-svg-panel',
      plugin_type: 'panel',
      path: '/plugins/ace-svg-panel',
      deflection_reason: 'no_compatible_version',
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
  });
});
