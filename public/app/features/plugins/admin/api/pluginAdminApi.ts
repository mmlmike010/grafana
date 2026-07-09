import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients/rtkq';
import { type PluginError, type PluginMeta } from '@grafana/data';
import { type PluginDashboard } from 'app/types/plugins';

import { API_ROOT, GCOM_API_ROOT, INSTANCE_API_ROOT } from '../constants';
import {
  type CatalogPluginInsights,
  type InstancePlugin,
  type LocalPlugin,
  type PluginVersion,
  type RemotePlugin,
  type Version,
} from '../types';

/** RTK Query slice for the plugins admin (catalog) vertical. */
export const pluginAdminApi = createApi({
  reducerPath: 'pluginAdminApi',
  baseQuery: createBaseQuery({ baseURL: '' }),
  tagTypes: [
    'PluginCatalog',
    'PluginCatalogRemoteList',
    'PluginCatalogRemote',
    'PluginCatalogVersions',
    'PluginCatalogMarkdown',
    'PluginCatalogInsights',
    'PluginCatalogErrors',
    'PluginCatalogInstance',
    'PluginCatalogProvisioned',
    'PluginDashboards',
  ],
  endpoints: (build) => ({
    getPluginCatalogErrors: build.query<PluginError[], void>({
      query: () => ({ url: `${API_ROOT}/errors` }),
      providesTags: [{ type: 'PluginCatalogErrors', id: 'LIST' }],
    }),

    getRemotePluginCatalogList: build.query<{ items: RemotePlugin[] }, void>({
      query: () => ({
        url: `${GCOM_API_ROOT}/plugins`,
        params: { includeDeprecated: 'true' },
      }),
      providesTags: [{ type: 'PluginCatalogRemoteList', id: 'LIST' }],
    }),

    getRemotePlugin: build.query<RemotePlugin, string>({
      query: (id) => ({ url: `${GCOM_API_ROOT}/plugins/${id}` }),
      providesTags: (_result, _err, id) => [{ type: 'PluginCatalogRemote', id }],
    }),

    getPluginVersion: build.query<PluginVersion, { id: string; version: string }>({
      query: ({ id, version }) => ({ url: `${GCOM_API_ROOT}/plugins/${id}/versions/${version}` }),
      providesTags: (_result, _err, { id, version }) => [
        { type: 'PluginCatalogVersions', id: `${id}:${version}` },
      ],
    }),

    getPluginVersions: build.query<{ items: PluginVersion[] }, string>({
      query: (id) => ({ url: `${GCOM_API_ROOT}/plugins/${id}/versions` }),
      providesTags: (_result, _err, id) => [{ type: 'PluginCatalogVersions', id }],
    }),

    getPluginInsights: build.query<CatalogPluginInsights, { id: string; version: string }>({
      query: ({ id, version }) => ({ url: `${GCOM_API_ROOT}/plugins/${id}/versions/${version}/insights` }),
      providesTags: (_result, _err, { id, version }) => [
        { type: 'PluginCatalogInsights', id: `${id}:${version}` },
      ],
    }),

    getLocalPluginReadmeMarkdown: build.query<string, string>({
      query: (id) => ({ url: `${API_ROOT}/${id}/markdown/README` }),
      providesTags: (_result, _err, id) => [{ type: 'PluginCatalogMarkdown', id: `${id}:README` }],
    }),

    getLocalPluginChangelogMarkdown: build.query<string, string>({
      query: (id) => ({ url: `${API_ROOT}/${id}/markdown/CHANGELOG` }),
      providesTags: (_result, _err, id) => [{ type: 'PluginCatalogMarkdown', id: `${id}:CHANGELOG` }],
    }),

    getLocalPlugins: build.query<LocalPlugin[], Record<string, string | number | boolean> | void>({
      query: (params) => ({
        url: API_ROOT,
        params: params ?? undefined,
      }),
      providesTags: [{ type: 'PluginCatalog', id: 'LOCAL_LIST' }],
    }),

    getInstancePlugins: build.query<InstancePlugin[], void>({
      query: () => ({ url: `${INSTANCE_API_ROOT}/plugins` }),
      providesTags: [{ type: 'PluginCatalogInstance', id: 'LIST' }],
    }),

    getProvisionedPlugins: build.query<Array<{ type: string }>, void>({
      query: () => ({ url: `${INSTANCE_API_ROOT}/provisioned-plugins` }),
      providesTags: [{ type: 'PluginCatalogProvisioned', id: 'LIST' }],
    }),

    installPlugin: build.mutation<unknown, { id: string; version?: string }>({
      query: ({ id, version }) => ({
        url: `${API_ROOT}/${id}/install`,
        method: 'POST',
        body: { version },
        showErrorAlert: false,
      }),
      invalidatesTags: [{ type: 'PluginCatalog', id: 'LOCAL_LIST' }],
    }),

    uninstallPlugin: build.mutation<unknown, { id: string }>({
      query: ({ id }) => ({
        url: `${API_ROOT}/${id}/uninstall`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'PluginCatalog', id: 'LOCAL_LIST' }],
    }),

    updatePluginCatalogSettings: build.mutation<unknown, { id: string; data: Partial<PluginMeta> }>({
      query: ({ id, data }) => ({
        url: `/api/plugins/${id}/settings`,
        method: 'POST',
        body: data,
      }),
    }),

    getPluginDashboards: build.query<PluginDashboard[], string>({
      query: (pluginId) => ({ url: `/api/plugins/${pluginId}/dashboards` }),
      providesTags: (_result, _err, pluginId) => [{ type: 'PluginDashboards', id: pluginId }],
    }),

    importPluginDashboard: build.mutation<
      PluginDashboard,
      { pluginId: string; path: string; overwrite: boolean; inputs: unknown[] }
    >({
      query: (body) => ({
        url: `/api/dashboards/import`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'PluginDashboards', id: arg.pluginId }],
    }),

    deleteImportedPluginDashboard: build.mutation<void, { pluginId: string; dashboardUid: string }>({
      query: ({ dashboardUid }) => ({
        url: `/api/dashboards/uid/${dashboardUid}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'PluginDashboards', id: arg.pluginId }],
    }),
  }),
});

export const {
  useGetPluginCatalogErrorsQuery,
  useLazyGetRemotePluginCatalogListQuery,
  useLazyGetRemotePluginQuery,
  useLazyGetPluginVersionQuery,
  useLazyGetPluginVersionsQuery,
  useLazyGetPluginInsightsQuery,
  useLazyGetLocalPluginReadmeMarkdownQuery,
  useLazyGetLocalPluginChangelogMarkdownQuery,
  useLazyGetLocalPluginsQuery,
  useLazyGetInstancePluginsQuery,
  useLazyGetProvisionedPluginsQuery,
  useInstallPluginMutation,
  useUninstallPluginMutation,
  useUpdatePluginCatalogSettingsMutation,
  useGetPluginDashboardsQuery,
  useImportPluginDashboardMutation,
  useDeleteImportedPluginDashboardMutation,
} = pluginAdminApi;
