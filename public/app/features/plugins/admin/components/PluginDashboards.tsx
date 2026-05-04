import { extend } from 'lodash';
import { memo, useCallback, useEffect, useState } from 'react';

import { AppEvents, type PluginMeta, type DataSourceApi } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import DashboardsTable from 'app/features/datasources/components/DashboardsTable';
import { dispatch } from 'app/store/store';
import { type PluginDashboard } from 'app/types/plugins';

import { pluginAdminApi } from '../api/pluginAdminApi';

interface Props {
  plugin: PluginMeta;
  datasource?: DataSourceApi;
}

export const PluginDashboards = memo(function PluginDashboards({ plugin, datasource }: Props) {
  const [dashboards, setDashboards] = useState<PluginDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDashboardMutation] = pluginAdminApi.useImportPluginDashboardMutation();
  const [deleteImportedDashboardMutation] = pluginAdminApi.useDeleteImportedPluginDashboardMutation();

  useEffect(() => {
    setLoading(true);
    const subscription = dispatch(pluginAdminApi.endpoints.getPluginDashboards.initiate(plugin.id));
    subscription
      .unwrap()
      .then((loaded) => {
        setDashboards(loaded);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [plugin.id]);

  const importDashboard = useCallback(
    (dash: PluginDashboard, overwrite: boolean) => {
      const installCmd = {
        pluginId: plugin.id,
        path: dash.path,
        overwrite: overwrite,
        inputs: datasource
          ? [
              {
                name: '*',
                type: 'datasource',
                pluginId: datasource.meta.id,
                value: datasource.name,
              },
            ]
          : [],
      };

      return importDashboardMutation(installCmd).then((res) => {
        if ('data' in res && res.data) {
          appEvents.emit(AppEvents.alertSuccess, ['Dashboard Imported', dash.title]);
          extend(dash, res.data);
          setDashboards((prev) => [...prev]);
        }
      });
    },
    [plugin.id, datasource, importDashboardMutation]
  );

  const remove = useCallback(
    (dash: PluginDashboard) => {
      deleteImportedDashboardMutation({ pluginId: plugin.id, dashboardUid: dash.uid }).then(() => {
        dash.imported = false;
        setDashboards((prev) => [...prev]);
      });
    },
    [plugin.id, deleteImportedDashboardMutation]
  );

  if (loading) {
    return (
      <div>
        <Trans i18nKey="plugins.plugin-dashboards.loading">Loading...</Trans>
      </div>
    );
  }
  if (!dashboards || !dashboards.length) {
    return (
      <div>
        <Trans i18nKey="plugins.plugin-dashboards.dashboards-included-plugin">
          No dashboards are included with this plugin
        </Trans>
      </div>
    );
  }

  return <DashboardsTable dashboards={dashboards} onImport={importDashboard} onRemove={remove} />;
});
