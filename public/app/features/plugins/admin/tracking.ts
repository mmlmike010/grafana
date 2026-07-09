import { reportInteraction } from '@grafana/runtime';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

export const PLUGIN_INSTALL_DEFLECTED_EVENT = 'plugin_install_deflected';
export const PLUGIN_INSTALL_READINESS_VIEWED_EVENT = 'plugin_install_readiness_viewed';

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};

type InstallReadinessTrackingProps = PluginTrackingProps & {
  blockers: string[];
  can_install?: boolean;
};

export const trackPluginInstallDeflected = (props: InstallReadinessTrackingProps) => {
  reportInteraction(PLUGIN_INSTALL_DEFLECTED_EVENT, props);
};

export const trackPluginInstallReadinessViewed = (props: InstallReadinessTrackingProps) => {
  reportInteraction(PLUGIN_INSTALL_READINESS_VIEWED_EVENT, props);
};
