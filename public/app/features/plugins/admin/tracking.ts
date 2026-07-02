import { reportInteraction } from '@grafana/runtime';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

export type PluginInstallDeflectedProps = PluginTrackingProps & {
  readiness_status: string;
  readiness_reason: string;
  plugin_status?: string;
  latest_compatible_version?: string;
  grafana_dependency?: string;
  creator_team?: string;
  schema_version?: string;
};

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};

export const trackPluginInstallDeflected = (props: PluginInstallDeflectedProps) => {
  reportInteraction('grafana_plugin_install_deflected', {
    ...props,
    creator_team: props.creator_team ?? 'grafana_plugins_catalog',
    schema_version: props.schema_version ?? '1.0.0',
  });
};
