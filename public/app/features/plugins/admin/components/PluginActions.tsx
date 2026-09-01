import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

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
import { type CatalogPlugin, type InstallReadiness, PluginStatus, type Version } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const [needReload, setNeedReload] = useState(false);
  const readiness = plugin
    ? getInstallReadiness(plugin, isRemotePluginsAvailable, latestCompatibleVersion)
    : undefined;

  useTrackInstallDeflection(plugin, readiness);

  if (!plugin || plugin.angularDetected || !readiness) {
    return null;
  }

  const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
  const pluginStatus = getPluginStatus(plugin, latestCompatibleVersion);
  const isInstallControlsDisabled = getInstallControlsDisabled(plugin, latestCompatibleVersion);

  return (
    <Stack direction="column">
      <Stack alignItems="center">
        <InstallReadinessIndicator plugin={plugin} readiness={readiness} />
        {!isInstallControlsDisabled && (
          <InstallControlsButton
            plugin={plugin}
            latestCompatibleVersion={latestCompatibleVersion}
            pluginStatus={pluginStatus}
            setNeedReload={setNeedReload}
            hasInstallWarning={hasInstallWarning}
          />
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

function useTrackInstallDeflection(plugin: CatalogPlugin | undefined, readiness: InstallReadiness | undefined) {
  const deflectionReason =
    readiness?.status === 'blocked'
      ? readiness.reasons[0]
      : readiness?.status === 'warning'
        ? readiness.warningReason
        : undefined;

  useEffect(() => {
    if (!plugin || plugin.angularDetected || plugin.isInstalled || !deflectionReason) {
      return;
    }

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: window.location.pathname,
      deflection_reason: deflectionReason,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
  }, [plugin, deflectionReason]);
}

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
