import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginErrorCode } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin/GetStartedWithPlugin';
import { InstallReadinessIndicator } from '../components/InstallReadinessIndicator';
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

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const readiness = plugin ? getInstallReadiness(plugin, latestCompatibleVersion, isRemotePluginsAvailable) : undefined;
  const [needReload, setNeedReload] = useState(false);
  const trackedDeflection = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!plugin || plugin.isInstalled || !readiness?.reason || readiness.status === 'ready') {
      return;
    }

    const deflectionKey = `${plugin.id}:${readiness.reason}`;
    if (trackedDeflection.current === deflectionKey) {
      return;
    }
    trackedDeflection.current = deflectionKey;

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      blocker_reason: readiness.reason,
      readiness_status: readiness.status,
      selected_version: readiness.version,
    });
  }, [location.pathname, plugin, readiness?.reason, readiness?.status, readiness?.version]);

  if (!plugin || plugin.angularDetected) {
    return null;
  }

  const hasInstallWarning =
    hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion) ||
    readiness?.status === 'blocked';
  const pluginStatus = getPluginStatus(plugin, latestCompatibleVersion);
  const isInstallControlsDisabled = getInstallControlsDisabled(plugin, latestCompatibleVersion);

  return (
    <Stack direction="column">
      <Stack alignItems="center">
        {!isInstallControlsDisabled && (
          <>
            {pluginStatus !== PluginStatus.UNINSTALL && readiness && (
              <InstallReadinessIndicator plugin={plugin} readiness={readiness} />
            )}
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
