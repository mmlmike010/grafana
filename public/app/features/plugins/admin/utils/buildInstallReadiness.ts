import {
  isUnsignedPluginSignature,
  PluginSignatureStatus,
  PluginType,
  type PluginSignatureType,
} from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  getLatestCompatibleVersion,
  hasInstallControlWarning,
} from '../helpers';
import { type CatalogPlugin, type Version } from '../types';

export type InstallReadinessBlocker =
  | 'incompatible_version'
  | 'unsigned_plugin'
  | 'no_permission'
  | 'enterprise_required'
  | 'remote_unavailable'
  | 'unpublished'
  | 'renderer_plugin'
  | 'dev_plugin';

export interface PluginInstallReadinessContext {
  grafanaVersion: string;
  allowUnsignedPlugins: boolean;
  signatureStatus?: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
  grafanaDependency?: string;
  maintainerName?: string;
}

export interface InstallReadinessSummary {
  grafanaVersion: string;
  grafanaDependency?: string;
  targetVersion?: string;
  isCompatible: boolean;
  signatureStatus: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
  isUnsigned: boolean;
  allowUnsignedPlugins: boolean;
  maintainerName?: string;
  maintainerUrl?: string;
  hasChangelog: boolean;
  changelogPath?: string;
  canInstall: boolean;
  blockers: InstallReadinessBlocker[];
}

export function buildInstallReadiness(
  plugin: CatalogPlugin,
  isRemotePluginsAvailable: boolean,
  serverContext?: PluginInstallReadinessContext
): InstallReadinessSummary {
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const grafanaDependency =
    latestCompatibleVersion?.grafanaDependency ||
    plugin.details?.grafanaDependency ||
    serverContext?.grafanaDependency;

  const signatureStatus =
    plugin.signature ||
    serverContext?.signatureStatus ||
    PluginSignatureStatus.missing;

  const isUnsigned = isUnsignedPluginSignature(signatureStatus);
  const allowUnsignedPlugins = serverContext?.allowUnsignedPlugins ?? false;
  const blockers = collectInstallBlockers(
    plugin,
    isRemotePluginsAvailable,
    latestCompatibleVersion,
    isUnsigned,
    allowUnsignedPlugins
  );

  const canInstall = blockers.length === 0 && !plugin.isInstalled;

  return {
    grafanaVersion: serverContext?.grafanaVersion ?? config.buildInfo.version,
    grafanaDependency,
    targetVersion: latestCompatibleVersion?.version ?? plugin.latestVersion,
    isCompatible: Boolean(latestCompatibleVersion),
    signatureStatus,
    signatureType: plugin.signatureType ?? serverContext?.signatureType,
    signatureOrg: plugin.signatureOrg ?? serverContext?.signatureOrg,
    isUnsigned,
    allowUnsignedPlugins,
    maintainerName: plugin.orgName || serverContext?.maintainerName,
    maintainerUrl: plugin.url,
    hasChangelog: Boolean(plugin.details?.changelog),
    changelogPath: plugin.details?.changelog ? `?page=changelog` : undefined,
    canInstall,
    blockers,
  };
}

function collectInstallBlockers(
  plugin: CatalogPlugin,
  isRemotePluginsAvailable: boolean,
  latestCompatibleVersion: Version | undefined,
  isUnsigned: boolean,
  allowUnsignedPlugins: boolean
): InstallReadinessBlocker[] {
  const blockers: InstallReadinessBlocker[] = [];

  if (plugin.type === PluginType.renderer) {
    blockers.push('renderer_plugin');
  }

  if (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) {
    blockers.push('enterprise_required');
  }

  if (plugin.isDev) {
    blockers.push('dev_plugin');
  }

  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  if (!hasPermission && !isExternallyManaged) {
    blockers.push('no_permission');
  }

  if (!plugin.isPublished) {
    blockers.push('unpublished');
  }

  if (!latestCompatibleVersion) {
    blockers.push('incompatible_version');
  }

  if (!isRemotePluginsAvailable) {
    blockers.push('remote_unavailable');
  }

  if (isUnsigned && !allowUnsignedPlugins) {
    blockers.push('unsigned_plugin');
  }

  return blockers;
}

export function shouldShowInstallReadinessCard(
  plugin: CatalogPlugin,
  isRemotePluginsAvailable: boolean
): boolean {
  if (plugin.isCore || plugin.isProvisioned) {
    return false;
  }

  if (!plugin.isPublished && plugin.isInstalled) {
    return false;
  }

  return plugin.isPublished || hasInstallControlWarning(plugin, isRemotePluginsAvailable, getLatestCompatibleVersion(plugin.details?.versions));
}
