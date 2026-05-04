import { type PluginError, type PluginMeta, renderMarkdown } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { installPluginMeta, logPluginMetaError, uninstallPluginMeta } from '@grafana/runtime/internal';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { isVersionGtOrEq } from 'app/core/utils/version';
import { dispatch } from 'app/store/store';

import { GCOM_API_ROOT } from './constants';
import { isLocalPluginVisibleByConfig, isRemotePluginVisibleByConfig } from './helpers';
import {
  type LocalPlugin,
  type RemotePlugin,
  type CatalogPluginDetails,
  type CatalogPluginInsights,
  type Version,
  type PluginVersion,
  type InstancePlugin,
  type ProvisionedPlugin,
} from './types';
import { pluginAdminApi } from './api/pluginAdminApi';

export async function getPluginDetails(id: string): Promise<CatalogPluginDetails> {
  const remote = await getRemotePlugin(id);
  const isPublished = Boolean(remote);
  const [localPlugins, versions, localReadme, localChangelog] = await Promise.all([
    getLocalPlugins(),
    getPluginVersions(id, isPublished),
    getLocalPluginReadme(id),
    getLocalPluginChangelog(id),
  ]);

  const local = localPlugins.find((p) => p.id === id);
  const dependencies = local?.dependencies || remote?.json?.dependencies;

  // Add installed version to the list if it's missing (could be deprecated/deleted)
  const installedVersion = local?.info.version;
  const installedVersionMissing = !versions.some((v) => v.version === installedVersion);
  if (installedVersion && installedVersionMissing) {
    const missingVersion = await getPluginVersion(id, installedVersion);
    if (missingVersion?.status === 'deprecated') {
      missingVersion.isCompatible = false;
      versions.push(missingVersion);
      versions.sort((a, b) => {
        return isVersionGtOrEq(a.version, b.version) ? -1 : 1;
      });
    }
  }

  return {
    grafanaDependency: dependencies?.grafanaDependency ?? dependencies?.grafanaVersion ?? '',
    pluginDependencies: dependencies?.plugins || [],
    links: local?.info.links || remote?.json?.info.links || [],
    readme: localReadme || remote?.readme,
    versions,
    statusContext: remote?.statusContext ?? '',
    iam: remote?.json?.iam,
    changelog: remote?.changelog || localChangelog,
    licenseUrl: remote?.licenseUrl,
    documentationUrl: remote?.documentationUrl,
    sponsorshipUrl: remote?.sponsorshipUrl,
    repositoryUrl: remote?.repositoryUrl,
    raiseAnIssueUrl: remote?.raiseAnIssueUrl,
    signatureType: local?.signatureType || (remote?.signatureType !== '' ? remote?.signatureType : undefined),
    signature: local?.signature,
    screenshots: remote?.json?.info.screenshots || local?.info.screenshots,
  };
}

export async function getPluginInsights(id: string, version: string | undefined): Promise<CatalogPluginInsights> {
  if (!version) {
    throw new Error('Version is required');
  }
  try {
    return await dispatch(
      pluginAdminApi.endpoints.getPluginInsights.initiate({ id, version })
    ).unwrap();
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    throw error;
  }
}

export async function getRemotePlugins(): Promise<RemotePlugin[]> {
  try {
    const { items: remotePlugins }: { items: RemotePlugin[] } = await dispatch(
      pluginAdminApi.endpoints.getRemotePluginCatalogList.initiate()
    ).unwrap();

    return remotePlugins.filter(isRemotePluginVisibleByConfig);
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
      console.error('Failed to fetch plugins from catalog (default https://grafana.com/api/plugins)');
      return [];
    }

    throw error;
  }
}

export async function getPluginErrors(): Promise<PluginError[]> {
  try {
    return await dispatch(pluginAdminApi.endpoints.getPluginCatalogErrors.initiate()).unwrap();
  } catch (error) {
    return [];
  }
}

async function getRemotePlugin(id: string): Promise<RemotePlugin | undefined> {
  try {
    return await dispatch(pluginAdminApi.endpoints.getRemotePlugin.initiate(id)).unwrap();
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
    }
    return;
  }
}

async function getPluginVersion(id: string, version: string): Promise<Version | null> {
  try {
    const v: PluginVersion = await dispatch(
      pluginAdminApi.endpoints.getPluginVersion.initiate({ id, version })
    ).unwrap();

    return {
      version: v.version,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      isCompatible: v.isCompatible,
      grafanaDependency: v.grafanaDependency,
      angularDetected: v.angularDetected,
      status: v.status,
    };
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
    }
    return null;
  }
}

async function getPluginVersions(id: string, isPublished: boolean): Promise<Version[]> {
  try {
    if (!isPublished) {
      return [];
    }

    const versions: { items: PluginVersion[] } = await dispatch(
      pluginAdminApi.endpoints.getPluginVersions.initiate(id)
    ).unwrap();

    return (versions.items || []).map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      isCompatible: v.isCompatible,
      grafanaDependency: v.grafanaDependency,
      angularDetected: v.angularDetected,
      status: v.status,
    }));
  } catch (error) {
    if (isFetchError(error)) {
      // It can happen that GCOM is not available, in that case we show a limited set of information to the user.
      error.isHandled = true;
    }
    return [];
  }
}

async function getLocalPluginReadme(id: string): Promise<string> {
  try {
    const markdown: string = await dispatch(
      pluginAdminApi.endpoints.getLocalPluginReadmeMarkdown.initiate(id)
    ).unwrap();
    const markdownAsHtml = markdown ? renderMarkdown(markdown) : '';

    return markdownAsHtml;
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return '';
  }
}

async function getLocalPluginChangelog(id: string): Promise<string> {
  try {
    const markdown: string = await dispatch(
      pluginAdminApi.endpoints.getLocalPluginChangelogMarkdown.initiate(id)
    ).unwrap();
    const markdownAsHtml = markdown ? renderMarkdown(markdown) : '';
    return markdownAsHtml;
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return '';
  }
}

export async function getLocalPlugins(): Promise<LocalPlugin[]> {
  const localPlugins: LocalPlugin[] = await dispatch(
    pluginAdminApi.endpoints.getLocalPlugins.initiate(accessControlQueryParam({ embedded: 0 }))
  ).unwrap();

  return localPlugins.filter(isLocalPluginVisibleByConfig);
}

export async function getInstancePlugins(): Promise<InstancePlugin[]> {
  const { items: instancePlugins }: { items: InstancePlugin[] } = await dispatch(
    pluginAdminApi.endpoints.getInstancePlugins.initiate()
  ).unwrap();

  return instancePlugins;
}

export async function getProvisionedPlugins(): Promise<ProvisionedPlugin[]> {
  const { items: provisionedPlugins }: { items: Array<{ type: string }> } = await dispatch(
    pluginAdminApi.endpoints.getProvisionedPlugins.initiate()
  ).unwrap();

  return provisionedPlugins.map((plugin) => ({ slug: plugin.type }));
}

export async function installPlugin(id: string, version?: string) {
  // Install via K8s PluginMeta API (no-op when useMTPlugins is off).
  // We call both this and the legacy path because the K8s settings API doesn't cover all
  // plugin types yet — the legacy call keeps the UI in sync across browser refreshes.
  // TODO(@hugohaggmark): return early once all plugin types support the K8s Settings API.
  try {
    await installPluginMeta(id, version ?? '');
  } catch (error: unknown) {
    logPluginMetaError(`PluginMeta: Failed to install plugin with id ${id} and version ${version}`, error);
  }

  // Legacy install path — kept until K8s settings API covers all plugin types.
  return await dispatch(
    pluginAdminApi.endpoints.installPlugin.initiate({ id, version })
  ).unwrap();
}

export async function uninstallPlugin(id: string) {
  // Uninstall via K8s PluginMeta API (no-op when useMTPlugins is off).
  // We call both this and the legacy path because the K8s settings API doesn't cover all
  // plugin types yet — the legacy call keeps the UI in sync across browser refreshes.
  // TODO(@hugohaggmark): return early once all plugin types support the K8s Settings API.
  try {
    await uninstallPluginMeta(id);
  } catch (error: unknown) {
    logPluginMetaError(`PluginMeta: Failed to uninstall plugin with id ${id}`, error);
  }

  // Legacy uninstall path — kept until K8s settings API covers all plugin types.
  return await dispatch(pluginAdminApi.endpoints.uninstallPlugin.initiate({ id })).unwrap();
}

export async function updatePluginSettings(id: string, data: Partial<PluginMeta>) {
  return await dispatch(
    pluginAdminApi.endpoints.updatePluginCatalogSettings.initiate({ id, data })
  ).unwrap();
}

export const api = { getRemotePlugins, getInstalledPlugins: getLocalPlugins, installPlugin, uninstallPlugin };
