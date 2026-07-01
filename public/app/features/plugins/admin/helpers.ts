import uFuzzy from '@leeoniya/ufuzzy';

import { PluginSignatureStatus, dateTimeParse, type PluginError, PluginType, PluginErrorCode } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  type CatalogPlugin,
  type InstancePlugin,
  type LocalPlugin,
  InstallReadinessReason,
  InstallReadinessSeverity,
  type InstallReadinessResult,
  PluginUpdateStrategy,
  type ProvisionedPlugin,
  type RemotePlugin,
  RemotePluginStatus,
  type Version,
} from './types';

export function mergeLocalsAndRemotes({
  local = [],
  remote = [],
  instance = [],
  provisioned = [],
  pluginErrors: errors,
}: {
  local: LocalPlugin[];
  remote?: RemotePlugin[];
  instance?: InstancePlugin[];
  provisioned?: ProvisionedPlugin[];
  pluginErrors?: PluginError[];
}): CatalogPlugin[] {
  const catalogPlugins: CatalogPlugin[] = [];
  const errorByPluginId = groupErrorsByPluginId(errors);

  const remoteSet = new Set<string>(remote?.map((plugin) => plugin.slug));
  const localMap = new Map<string, LocalPlugin>(local.map((plugin) => [plugin.id, plugin]));
  const instancesMap = new Map<string, InstancePlugin>(instance?.map((plugin) => [plugin.pluginSlug, plugin]));
  const provisionedSet = new Set<string>(provisioned?.map((plugin) => plugin.slug));

  // add locals
  local.forEach((localPlugin) => {
    const error = errorByPluginId[localPlugin.id];

    if (!remoteSet.has(localPlugin.id)) {
      let catalogPlugin = mergeLocalAndRemote(localPlugin, undefined, error);
      if (config.pluginAdminExternalManageEnabled) {
        catalogPlugin = mergeCloudState(
          catalogPlugin,
          instancesMap,
          provisionedSet.has(localPlugin.id),
          localMap.has(localPlugin.id)
        );
      }
      catalogPlugins.push(catalogPlugin);
    }
  });

  // add remote
  remote.forEach((remotePlugin) => {
    const localCounterpart = localMap.get(remotePlugin.slug);
    const error = errorByPluginId[remotePlugin.slug];
    const shouldSkip = remotePlugin.status === RemotePluginStatus.Deprecated && !localCounterpart; // We are only listing deprecated plugins in case they are installed.

    if (!shouldSkip) {
      let catalogPlugin = mergeLocalAndRemote(localCounterpart, remotePlugin, error);
      if (config.pluginAdminExternalManageEnabled) {
        catalogPlugin = mergeCloudState(
          catalogPlugin,
          instancesMap,
          provisionedSet.has(remotePlugin.slug),
          localMap.has(remotePlugin.slug)
        );
      }
      catalogPlugins.push(catalogPlugin);
    }
  });

  return catalogPlugins;
}

export function mergeLocalAndRemote(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  if (!local && remote) {
    return mapRemoteToCatalog(remote, error);
  }

  if (local && !remote) {
    return mapLocalToCatalog(local, error);
  }

  return mapToCatalogPlugin(local, remote, error);
}

export function mapRemoteToCatalog(plugin: RemotePlugin, error?: PluginError): CatalogPlugin {
  const {
    name,
    slug: id,
    description,
    version,
    orgName,
    popularity,
    downloads,
    typeCode,
    updatedAt,
    createdAt: publishedAt,
    status,
    angularDetected,
    keywords,
    signatureType,
    versionSignatureType,
    versionSignedByOrgName,
    url,
  } = plugin;

  const isDisabled = !!error;
  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue('managedPluginsV2', false);

  return {
    description,
    downloads,
    id,
    info: {
      logos: {
        small: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${version}/logos/small`,
        large: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${version}/logos/large`,
      },
      keywords,
    },
    name,
    orgName,
    popularity,
    publishedAt,
    signature: getPluginSignature({ remote: plugin, error }),
    signatureType: signatureType || versionSignatureType || undefined,
    signatureOrg: versionSignedByOrgName,
    updatedAt,
    hasUpdate: false,
    isPublished: true,
    isInstalled: isDisabled,
    isDisabled: isDisabled,
    isPreinstalled: isPreinstalledPlugin(id),
    isDeprecated: status === RemotePluginStatus.Deprecated,
    isCore: plugin.internal,
    isDev: false,
    isEnterprise: status === RemotePluginStatus.Enterprise,
    type: typeCode,
    error: error?.errorCode,
    angularDetected,
    isFullyInstalled: isDisabled,
    latestVersion: plugin.version,
    url,
    managed: {
      enabled: managedPluginsV2Enabled ? Boolean(plugin.managed?.enabled) : isManagedPlugin(id),
      strategy: managedPluginsV2Enabled
        ? plugin.managed?.strategy
        : isManagedPlugin(id)
          ? PluginUpdateStrategy.Assigned
          : undefined,
    },
  };
}

export function mapLocalToCatalog(plugin: LocalPlugin, error?: PluginError): CatalogPlugin {
  const {
    name,
    info: { description, version, logos, updated, author, keywords },
    id,
    dev,
    type,
    signature,
    signatureOrg,
    signatureType,
    hasUpdate,
    accessControl,
    angularDetected,
  } = plugin;

  const isDisabled = !!error;
  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue('managedPluginsV2', false);
  const isV1Managed = !managedPluginsV2Enabled && isManagedPlugin(id);

  return {
    description,
    downloads: 0,
    id,
    info: { logos, keywords },
    name,
    orgName: author.name,
    popularity: 0,
    publishedAt: '',
    signature: getPluginSignature({ local: plugin, error }),
    signatureOrg,
    signatureType,
    updatedAt: updated,
    installedVersion: version,
    hasUpdate,
    isInstalled: true,
    isDisabled: isDisabled,
    isCore: signature === 'internal',
    isPublished: false,
    isDeprecated: false,
    isDev: Boolean(dev),
    isEnterprise: false,
    isPreinstalled: isPreinstalledPlugin(id),
    type,
    error: error?.errorCode,
    accessControl: accessControl,
    angularDetected,
    isFullyInstalled: true,
    iam: plugin.iam,
    latestVersion: plugin.latestVersion,
    managed: {
      enabled: isV1Managed,
      strategy: isV1Managed ? PluginUpdateStrategy.Assigned : undefined,
    },
  };
}

// TODO: change the signature by removing the optionals for local and remote.
export function mapToCatalogPlugin(local?: LocalPlugin, remote?: RemotePlugin, error?: PluginError): CatalogPlugin {
  const installedVersion = local?.info.version;
  const id = remote?.slug || local?.id || '';
  const type = local?.type || remote?.typeCode;
  const isDisabled = !!error;
  const keywords = remote?.keywords || local?.info.keywords || [];

  let logos = {
    small: `/public/build/img/icn-${type}.svg`,
    large: `/public/build/img/icn-${type}.svg`,
  };

  if (remote) {
    logos = {
      small: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${remote.version}/logos/small`,
      large: `${config.appSubUrl}/api/gnet/plugins/${id}/versions/${remote.version}/logos/large`,
    };
  } else if (local && local.info.logos) {
    logos = local.info.logos;
  }

  const managedPluginsV2Enabled = getFeatureFlagClient().getBooleanValue('managedPluginsV2', false);

  return {
    description: local?.info.description || remote?.description || '',
    downloads: remote?.downloads || 0,
    hasUpdate: local?.hasUpdate || false,
    id,
    info: {
      logos,
      keywords,
    },
    isCore: Boolean(remote?.internal || local?.signature === PluginSignatureStatus.internal),
    isDev: Boolean(local?.dev),
    isEnterprise: remote?.status === RemotePluginStatus.Enterprise,
    isInstalled: Boolean(local) || isDisabled,
    isDisabled: isDisabled,
    isDeprecated: remote?.status === RemotePluginStatus.Deprecated,
    isPublished: true,
    isPreinstalled: isPreinstalledPlugin(id),
    // TODO<check if we would like to keep preferring the remote version>
    name: remote?.name || local?.name || '',
    // TODO<check if we would like to keep preferring the remote version>
    orgName: remote?.orgName || local?.info.author.name || '',
    popularity: remote?.popularity || 0,
    publishedAt: remote?.createdAt || '',
    type,
    signature: getPluginSignature({ local, remote, error }),
    signatureOrg: local?.signatureOrg || remote?.versionSignedByOrgName,
    signatureType: local?.signatureType || remote?.versionSignatureType || remote?.signatureType || undefined,
    // TODO<check if we would like to keep preferring the remote version>
    updatedAt: remote?.updatedAt || local?.info.updated || '',
    installedVersion,
    error: error?.errorCode,
    // Only local plugins have access control metadata
    accessControl: local?.accessControl,
    angularDetected: local?.angularDetected ?? remote?.angularDetected,
    isFullyInstalled: Boolean(local) || isDisabled,
    iam: local?.iam,
    latestVersion: local?.latestVersion || remote?.version || '',
    url: remote?.url || '',
    managed: {
      enabled: managedPluginsV2Enabled ? Boolean(remote?.managed?.enabled) : isManagedPlugin(id),
      strategy: managedPluginsV2Enabled
        ? remote?.managed?.strategy
        : isManagedPlugin(id)
          ? PluginUpdateStrategy.Assigned
          : undefined,
    },
  };
}

export const getExternalManageLink = (pluginId: string) => `${config.pluginCatalogURL}${pluginId}`;

export enum Sorters {
  nameAsc = 'nameAsc',
  nameDesc = 'nameDesc',
  updated = 'updated',
  published = 'published',
  downloads = 'downloads',
}

export const sortPlugins = (plugins: CatalogPlugin[], sortBy: Sorters) => {
  const sorters: { [name: string]: (a: CatalogPlugin, b: CatalogPlugin) => number } = {
    nameAsc: (a: CatalogPlugin, b: CatalogPlugin) => a.name.localeCompare(b.name),
    nameDesc: (a: CatalogPlugin, b: CatalogPlugin) => b.name.localeCompare(a.name),
    updated: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf(),
    published: (a: CatalogPlugin, b: CatalogPlugin) =>
      dateTimeParse(b.publishedAt).valueOf() - dateTimeParse(a.publishedAt).valueOf(),
    downloads: (a: CatalogPlugin, b: CatalogPlugin) => b.downloads - a.downloads,
  };

  if (sorters[sortBy]) {
    return plugins.sort(sorters[sortBy]);
  }

  return plugins;
};

function groupErrorsByPluginId(errors: PluginError[] = []): Record<string, PluginError | undefined> {
  return errors.reduce<Record<string, PluginError | undefined>>((byId, error) => {
    byId[error.pluginId] = error;
    return byId;
  }, {});
}

function getPluginSignature(options: {
  local?: LocalPlugin;
  remote?: RemotePlugin;
  error?: PluginError;
}): PluginSignatureStatus {
  const { error, local, remote } = options;

  if (error) {
    switch (error.errorCode) {
      case PluginErrorCode.invalidSignature:
        return PluginSignatureStatus.invalid;
      case PluginErrorCode.missingSignature:
        return PluginSignatureStatus.missing;
      case PluginErrorCode.modifiedSignature:
        return PluginSignatureStatus.modified;
    }
  }

  if (local?.signature) {
    return local.signature;
  }

  if (remote?.signatureType && remote?.versionSignatureType) {
    return PluginSignatureStatus.valid;
  }

  return PluginSignatureStatus.missing;
}

export function getLatestCompatibleVersion(versions: Version[] | undefined): Version | undefined {
  if (!versions) {
    return;
  }
  const [latest] = versions.filter((v) => Boolean(v.isCompatible));

  return latest;
}

const INSTALL_WARNING_REASONS: InstallReadinessReason[] = [
  'renderer',
  'enterprise_unlicensed',
  'dev',
  'no_permission',
  'not_published',
  'incompatible_version',
  'remote_unavailable',
];

const INSTALL_DEFLECTION_REASONS: InstallReadinessReason[] = [
  'angular_detected',
  'catalog_disabled',
  'core',
  'provisioned',
  'disabled',
  ...INSTALL_WARNING_REASONS,
];

function getSignatureReadinessReason(signature: PluginSignatureStatus): InstallReadinessReason | null {
  switch (signature) {
    case PluginSignatureStatus.missing:
      return 'unsigned';
    case PluginSignatureStatus.invalid:
    case PluginSignatureStatus.modified:
      return 'invalid_signature';
    default:
      return null;
  }
}

function getInstallReadinessLinks(plugin: CatalogPlugin) {
  const sourceUrl = plugin.details?.repositoryUrl;
  const maintainerUrl =
    plugin.details?.orgUrl || plugin.url || plugin.details?.links?.find((link) => link.url)?.url;

  return {
    hasChangelog: Boolean(plugin.details?.changelog),
    sourceUrl,
    maintainerUrl,
  };
}

function getInstallWarningReason({
  plugin,
  latestCompatibleVersion,
  isRemotePluginsAvailable,
}: {
  plugin: CatalogPlugin;
  latestCompatibleVersion?: Version;
  isRemotePluginsAvailable: boolean;
}): InstallReadinessReason | null {
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  const isCompatible = Boolean(latestCompatibleVersion);

  if (plugin.type === PluginType.renderer) {
    return 'renderer';
  }

  if (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) {
    return 'enterprise_unlicensed';
  }

  if (plugin.isDev) {
    return 'dev';
  }

  if (!hasPermission && !isExternallyManaged) {
    return 'no_permission';
  }

  if (!plugin.isPublished) {
    return 'not_published';
  }

  if (!isCompatible) {
    return 'incompatible_version';
  }

  if (!isRemotePluginsAvailable) {
    return 'remote_unavailable';
  }

  return null;
}

export function getInstallReadiness({
  plugin,
  latestCompatibleVersion,
  isRemotePluginsAvailable,
}: {
  plugin: CatalogPlugin;
  pluginStatus?: PluginStatus;
  latestCompatibleVersion?: Version;
  isRemotePluginsAvailable: boolean;
}): InstallReadinessResult {
  const signatureStatus = plugin.signature;
  const grafanaDependency =
    latestCompatibleVersion?.grafanaDependency || plugin.details?.grafanaDependency || undefined;
  const links = getInstallReadinessLinks(plugin);

  const deflectionReason = !plugin.isInstalled
    ? getInstallDeflectionReason({
        plugin,
        latestCompatibleVersion,
        isRemotePluginsAvailable,
      })
    : null;

  const warningReason =
    deflectionReason && INSTALL_WARNING_REASONS.includes(deflectionReason)
      ? deflectionReason
      : getInstallWarningReason({ plugin, latestCompatibleVersion, isRemotePluginsAvailable });

  const activeReason = deflectionReason ?? warningReason;

  if (activeReason) {
    return {
      severity: isBlockedInstallReason(activeReason)
        ? InstallReadinessSeverity.Blocked
        : InstallReadinessSeverity.Warning,
      reason: activeReason,
      label: getInstallReadinessLabel(activeReason),
      signatureStatus,
      latestCompatibleVersion,
      grafanaDependency,
      ...links,
      hasInstallWarning: Boolean(warningReason),
    };
  }

  const signatureReason = getSignatureReadinessReason(signatureStatus);
  if (signatureReason) {
    return {
      severity: InstallReadinessSeverity.Warning,
      reason: signatureReason,
      label: getInstallReadinessLabel(signatureReason),
      signatureStatus,
      latestCompatibleVersion,
      grafanaDependency,
      ...links,
      hasInstallWarning: false,
    };
  }

  return {
    severity: InstallReadinessSeverity.Ready,
    reason: 'ready',
    label: getInstallReadinessLabel('ready'),
    signatureStatus,
    latestCompatibleVersion,
    grafanaDependency,
    ...links,
    hasInstallWarning: false,
  };
}

function isBlockedInstallReason(reason: InstallReadinessReason) {
  return (
    reason === 'core' ||
    reason === 'disabled' ||
    reason === 'provisioned' ||
    reason === 'catalog_disabled' ||
    reason === 'angular_detected'
  );
}

export function getInstallReadinessLabel(reason: InstallReadinessReason): string {
  switch (reason) {
    case 'ready':
      return 'Ready';
    case 'renderer':
      return 'Renderer';
    case 'enterprise_unlicensed':
      return 'Enterprise';
    case 'dev':
      return 'Dev build';
    case 'no_permission':
      return 'No permission';
    case 'not_published':
      return 'Not published';
    case 'incompatible_version':
      return 'Incompatible';
    case 'remote_unavailable':
      return 'Catalog unavailable';
    case 'core':
      return 'Core plugin';
    case 'disabled':
      return 'Disabled';
    case 'provisioned':
      return 'Provisioned';
    case 'catalog_disabled':
      return 'Catalog disabled';
    case 'angular_detected':
      return 'Angular';
    case 'unsigned':
      return 'Unsigned';
    case 'invalid_signature':
      return 'Invalid signature';
    default:
      return 'Blocked';
  }
}

export function getInstallDeflectionReason({
  plugin,
  latestCompatibleVersion,
  isRemotePluginsAvailable,
}: {
  plugin: CatalogPlugin;
  pluginStatus?: PluginStatus;
  latestCompatibleVersion?: Version;
  isRemotePluginsAvailable: boolean;
}): InstallReadinessReason | null {
  if (plugin.isInstalled) {
    return null;
  }

  if (plugin.angularDetected) {
    return 'angular_detected';
  }

  if (!isInstallControlsEnabled()) {
    return 'catalog_disabled';
  }

  if (plugin.isCore) {
    return 'core';
  }

  if (plugin.isProvisioned) {
    return 'provisioned';
  }

  if (plugin.isDisabled && !(isDisabledAngularPlugin(plugin) && isNonAngularVersion(latestCompatibleVersion))) {
    return 'disabled';
  }

  return getInstallWarningReason({ plugin, latestCompatibleVersion, isRemotePluginsAvailable });
}

export function getInstallDeflectionReasonForTelemetry(
  args: Parameters<typeof getInstallDeflectionReason>[0]
): InstallReadinessReason | null {
  const reason = getInstallDeflectionReason(args);

  if (!reason || !INSTALL_DEFLECTION_REASONS.includes(reason)) {
    return null;
  }

  return reason;
}

export const isInstallControlsEnabled = () => config.pluginAdminEnabled;

export const hasInstallControlWarning = (
  plugin: CatalogPlugin,
  isRemotePluginsAvailable: boolean,
  latestCompatibleVersion?: Version
) => {
  return (
    getInstallWarningReason({
      plugin,
      latestCompatibleVersion,
      isRemotePluginsAvailable,
    }) !== null
  );
};

export const isLocalPluginVisibleByConfig = (p: LocalPlugin) => isNotHiddenByConfig(p.id);

export const isRemotePluginVisibleByConfig = (p: RemotePlugin) => isNotHiddenByConfig(p.slug);

function isNotHiddenByConfig(id: string) {
  const { pluginCatalogHiddenPlugins }: { pluginCatalogHiddenPlugins: string[] } = config;

  return !pluginCatalogHiddenPlugins.includes(id);
}

/**
 * isManagedPlugin checks if the plugin is managed according to the instances config
 * this will be removed when managed plugins v2 is fully enabled
 * @param id - The plugin ID
 * @returns True if the plugin is managed
 */
export function isManagedPlugin(id: string) {
  const { pluginCatalogManagedPlugins }: { pluginCatalogManagedPlugins: string[] } = config;

  return pluginCatalogManagedPlugins?.includes(id);
}

export function isPreinstalledPlugin(id: string): { found: boolean; withVersion: boolean } {
  const { pluginCatalogPreinstalledPlugins } = config;

  const plugin = pluginCatalogPreinstalledPlugins?.find((p) => p.id === id);
  return { found: !!plugin?.id, withVersion: !!plugin?.version };
}

export function isLocalCorePlugin(local?: LocalPlugin): boolean {
  return Boolean(local?.signature === 'internal');
}

function getId(inputString: string): string {
  const parts = inputString.split(' - ');
  return parts[0];
}

function getPluginDetailsForFuzzySearch(plugins: CatalogPlugin[]): string[] {
  return plugins.reduce((result: string[], { id, name, type, orgName, info }: CatalogPlugin) => {
    const keywordsForSearch = info.keywords?.join(' ').toLowerCase();
    const pluginString = `${id} - ${name} - ${type} - ${orgName} - ${keywordsForSearch}`;
    result.push(pluginString);
    return result;
  }, []);
}
export function filterByKeyword(plugins: CatalogPlugin[], query: string) {
  const dataArray = getPluginDetailsForFuzzySearch(plugins);
  let uf = new uFuzzy({ intraMode: 1, intraSub: 0 });
  let idxs = uf.filter(dataArray, query);
  if (idxs === null) {
    return null;
  }
  return idxs.map((id) => getId(dataArray[id]));
}

function isPluginModifiable(plugin: CatalogPlugin) {
  if (
    plugin.isProvisioned || //provisioned plugins cannot be modified
    plugin.isCore || //core plugins cannot be modified
    plugin.type === PluginType.renderer || // currently renderer plugins are not supported by the catalog due to complications related to installation / update / uninstall
    plugin.isPreinstalled.withVersion // Preinstalled plugins (with specified version) cannot be modified
  ) {
    return false;
  }

  // Managed plugins with 'assigned' strategy cannot be modified
  if (plugin.managed.enabled && plugin.managed.strategy === PluginUpdateStrategy.Assigned) {
    return false;
  }

  return true;
}

export function isPluginUpdatable(plugin: CatalogPlugin) {
  if (!isPluginModifiable(plugin)) {
    return false;
  }

  // If there is no update available, the plugin cannot be updated
  if (!plugin.hasUpdate) {
    return false;
  }

  // If the plugin is currently being updated, it should not be updated
  if (plugin.isUpdatingFromInstance) {
    return false;
  }

  return true;
}

export function shouldDisablePluginInstall(plugin: CatalogPlugin) {
  if (
    !isPluginModifiable(plugin) ||
    (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) ||
    !plugin.isPublished ||
    plugin.isDisabled ||
    !isInstallControlsEnabled()
  ) {
    return true;
  }

  return false;
}

export function isNonAngularVersion(version?: Version) {
  if (!version) {
    return false;
  }

  return version.angularDetected === false;
}

export function isDisabledAngularPlugin(plugin: CatalogPlugin) {
  return plugin.isDisabled && plugin.error === PluginErrorCode.angular;
}

export function mergeCloudState(
  catalogPlugin: CatalogPlugin,
  instanceMap: Map<string, InstancePlugin>,
  isProvisioned: boolean,
  hasLocal: boolean
) {
  const instancePlugin = instanceMap.get(catalogPlugin.id);

  return {
    ...catalogPlugin,
    isFullyInstalled: catalogPlugin.isCore
      ? true
      : (instanceMap.has(catalogPlugin.id) || isProvisioned) && catalogPlugin.isInstalled,
    isInstalled: instanceMap.has(catalogPlugin.id) || catalogPlugin.isInstalled,
    isUpdatingFromInstance:
      instanceMap.has(catalogPlugin.id) &&
      catalogPlugin.hasUpdate &&
      catalogPlugin.installedVersion !== instancePlugin?.version,
    hasUpdate: Boolean(instancePlugin?.version && instancePlugin?.version !== catalogPlugin.latestVersion),
    isUninstallingFromInstance: hasLocal && !instanceMap.has(catalogPlugin.id),
    isProvisioned: isProvisioned,
  };
}
