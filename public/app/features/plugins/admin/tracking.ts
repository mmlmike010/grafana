import { reportInteraction } from '@grafana/runtime';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

export type PluginInstallDeflectedReason =
  | 'renderer'
  | 'enterprise_unlicensed'
  | 'dev_build'
  | 'unpublished'
  | 'no_permission'
  | 'no_compatible_version'
  | 'remote_catalog_unavailable'
  | 'unsigned_signature'
  | 'invalid_signature';

type PluginInstallDeflectedProps = PluginTrackingProps & {
  deflection_reason: PluginInstallDeflectedReason;
  creator_team: 'grafana_plugins_catalog';
  schema_version: '1.0.0';
};

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};

export const trackPluginInstallDeflected = (props: PluginInstallDeflectedProps) => {
  reportInteraction('grafana_plugin_install_deflected', props);
};
