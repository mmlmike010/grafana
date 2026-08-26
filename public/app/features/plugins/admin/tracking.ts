import { reportInteraction } from '@grafana/runtime';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};

type PluginInstallDeflectedProps = PluginTrackingProps & {
  // Why install was deflected (e.g. incompatible, unsigned)
  reason: string;
  // ready | warning | blocked
  status: string;
  creator_team?: string;
  schema_version?: string;
};

const reportedInstallDeflections = new Set<string>();

export const trackPluginInstallDeflected = (props: PluginInstallDeflectedProps) => {
  const deflectionKey = `${props.plugin_id}:${props.reason}`;
  if (reportedInstallDeflections.has(deflectionKey)) {
    return;
  }
  reportedInstallDeflections.add(deflectionKey);
  reportInteraction('grafana_plugin_install_deflected', props);
};

export const resetPluginInstallDeflectionTracking = () => {
  reportedInstallDeflections.clear();
};
