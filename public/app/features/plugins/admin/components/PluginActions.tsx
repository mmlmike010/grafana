import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginErrorCode } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin/GetStartedWithPlugin';
import { InstallControlsButton } from '../components/InstallControls/InstallControlsButton';
import {
  getInstallReadiness,
  getLatestCompatibleVersion,
  hasInstallControlWarning,
  isDisabledAngularPlugin,
  isInstallControlsEnabled,
  isNonAngularVersion,
} from '../helpers';
import { useIsRemotePluginsAvailable } from '../state/hooks';
import { trackPluginInstallDeflected } from '../tracking';
import { type CatalogPlugin, PluginStatus, type Version } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const [needReload, setNeedReload] = useState(false);
  const isInstallControlsDisabled = plugin ? getInstallControlsDisabled(plugin, latestCompatibleVersion) : true;
  const readiness =
    plugin && !plugin.angularDetected
      ? getInstallReadiness(plugin, isRemotePluginsAvailable, latestCompatibleVersion)
      : undefined;

  const pluginId = plugin?.id;
  const pluginType = plugin?.type;
  const readinessStatus = readiness?.status;
  const blockerReason = readiness?.blockerReason;

  useEffect(() => {
    if (!pluginId || !readinessStatus || isInstallControlsDisabled) {
      return;
    }
    if (readinessStatus === 'ready' || !blockerReason) {
      return;
    }

    trackPluginInstallDeflected({
      plugin_id: pluginId,
      plugin_type: pluginType,
      path: location.pathname,
      blocker_reason: blockerReason,
      status: readinessStatus,
    });
  }, [pluginId, pluginType, location.pathname, readinessStatus, blockerReason, isInstallControlsDisabled]);

  if (!plugin || plugin.angularDetected || !readiness) {
    return null;
  }

  const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
  const pluginStatus = getPluginStatus(plugin, latestCompatibleVersion);

  return (
    <Stack direction="column">
      <Stack alignItems="center">
        {!isInstallControlsDisabled && (
          <>
            <InstallReadinessIndicator readiness={readiness} />
            <InstallControlsButton
              plugin={plugin}
              latestCompatibleVersion={latestCompatibleVersion}
              pluginStatus={pluginStatus}
              setNeedReload={setNeedReload}
              hasInstallWarning={hasInstallWarning}
            />
          </>
        )}
        <GetStartedWithPlugin plugin={plugin} />
      </Stack>
      {needReload && (
        <Stack alignItems="center">
          <Icon name="exclamation-triangle" />
          <span className={styles.message}>
            <Trans i18nKey="plugins.plugin-actions.refresh-changes">Refresh the page to see the changes</Trans>
          </span>
        </Stack>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css({
      color: theme.colors.text.secondary,
    }),
  };
};

function getAngularPluginStatus(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined): PluginStatus {
  if (!plugin.isInstalled) {
    return PluginStatus.INSTALL;
  }

  if (isNonAngularVersion(latestCompatibleVersion)) {
    return PluginStatus.UPDATE;
  }

  return PluginStatus.UNINSTALL;
}

function getPluginStatus(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined) {
  if (plugin.error === PluginErrorCode.angular) {
    return getAngularPluginStatus(plugin, latestCompatibleVersion);
  }

  if (!plugin.isInstalled) {
    return PluginStatus.INSTALL;
  }

  if (plugin.hasUpdate) {
    return PluginStatus.UPDATE;
  }

  return PluginStatus.UNINSTALL;
}

function getInstallControlsDisabled(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined) {
  if (isDisabledAngularPlugin(plugin) && isNonAngularVersion(latestCompatibleVersion)) {
    return false;
  }

  return plugin.isCore || plugin.isDisabled || plugin.isProvisioned || !isInstallControlsEnabled();
}

export { getPluginStatus, getInstallControlsDisabled };
