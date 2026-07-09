import { reportInteraction } from '@grafana/runtime';

import { type InstallReadinessBlockerReason } from './helpers';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

type PluginInstallDeflectedProps = PluginTrackingProps & {
  // The reason the administrator could not (or should not) install the plugin.
  blocker_reason: InstallReadinessBlockerReason;
};

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};

// Fired when an administrator views a plugin detail page for a plugin that
// cannot (or should not) be installed in the current Grafana instance.
export const trackPluginInstallDeflected = (props: PluginInstallDeflectedProps) => {
  reportInteraction('grafana_plugin_install_deflected', props);
};
