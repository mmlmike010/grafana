import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, type BadgeColor, type IconName, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import {
  getInstallReadiness,
  type InstallReadiness,
  type InstallReadinessBlockerReason,
  type InstallReadinessStatus,
} from '../helpers';
import { trackPluginInstallDeflected } from '../tracking';
import { type CatalogPlugin, type Version } from '../types';

type Props = {
  plugin: CatalogPlugin;
  latestCompatibleVersion?: Version;
  isRemotePluginsAvailable: boolean;
};

const STATUS_BADGE: Record<InstallReadinessStatus, { color: BadgeColor; icon: IconName }> = {
  ready: {
    color: 'green',
    icon: 'check-circle',
  },
  warning: {
    color: 'orange',
    icon: 'exclamation-triangle',
  },
  blocked: {
    color: 'red',
    icon: 'exclamation-circle',
  },
};

function getStatusLabel(status: InstallReadinessStatus): string {
  switch (status) {
    case 'ready':
      return t('plugins.install-readiness.status-ready', 'Ready');
    case 'warning':
      return t('plugins.install-readiness.status-warning', 'Warning');
    case 'blocked':
      return t('plugins.install-readiness.status-blocked', 'Blocked');
  }
}

function getBlockerMessage(reason: InstallReadinessBlockerReason): string {
  switch (reason) {
    case 'incompatible':
      return t(
        'plugins.install-readiness.blocker-incompatible',
        'No version of this plugin is compatible with your Grafana version.'
      );
    case 'invalid_signature':
      return t(
        'plugins.install-readiness.blocker-invalid-signature',
        'This plugin has an invalid signature and should not be installed.'
      );
    case 'modified_signature':
      return t(
        'plugins.install-readiness.blocker-modified-signature',
        'This plugin signature is valid but the contents have been modified.'
      );
    case 'unsigned':
      return t(
        'plugins.install-readiness.blocker-unsigned',
        'This plugin is unsigned. Review the source before installing.'
      );
    case 'unpublished':
      return t(
        'plugins.install-readiness.blocker-unpublished',
        'This plugin is not published to grafana.com and cannot be managed from the catalog.'
      );
    case 'renderer':
      return t(
        'plugins.install-readiness.blocker-renderer',
        'Renderer plugins cannot be managed from the plugin catalog.'
      );
    case 'enterprise':
      return t(
        'plugins.install-readiness.blocker-enterprise',
        'This plugin requires Grafana Cloud or Grafana Enterprise.'
      );
    case 'dev':
      return t(
        'plugins.install-readiness.blocker-dev',
        'This is a development build and cannot be uninstalled from the catalog.'
      );
    case 'no_permission':
      return t('plugins.install-readiness.blocker-no-permission', 'You do not have permission to install plugins.');
    case 'remote_unavailable':
      return t(
        'plugins.install-readiness.blocker-remote-unavailable',
        'Install controls are disabled because Grafana cannot reach grafana.com.'
      );
  }
}

function getSignatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.valid:
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature-signed', 'Signed');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature-unsigned', 'Unsigned');
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature-invalid', 'Invalid signature');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature-modified', 'Modified signature');
    default:
      return t('plugins.install-readiness.signature-unknown', 'Unknown signature');
  }
}

function InstallReadinessDetails({ readiness }: { readiness: InstallReadiness }) {
  const blocker = readiness.blockerReason ? getBlockerMessage(readiness.blockerReason) : undefined;
  const version = readiness.latestCompatibleVersion ?? t('plugins.install-readiness.no-compatible-version', 'none');
  const range = readiness.grafanaDependency ?? t('plugins.install-readiness.dependency-unknown', 'not specified');
  const status = getSignatureLabel(readiness.signature);
  const name = readiness.maintainerName ?? t('plugins.install-readiness.maintainer-fallback', 'source');

  return (
    <Stack direction="column" gap={1}>
      {blocker && <Text>{blocker}</Text>}
      <Text>
        <Trans i18nKey="plugins.install-readiness.compatibility" values={{ version, range }}>
          Compatible version: {{ version }} (Grafana {{ range }})
        </Trans>
      </Text>
      <Text>
        <Trans i18nKey="plugins.install-readiness.signature" values={{ status }}>
          Signature: {{ status }}
        </Trans>
      </Text>
      {(readiness.changelogHref || readiness.maintainerHref) && (
        <Stack direction="row" gap={2}>
          {readiness.changelogHref && (
            <TextLink href={readiness.changelogHref} inline={false}>
              <Trans i18nKey="plugins.install-readiness.changelog">Changelog</Trans>
            </TextLink>
          )}
          {readiness.maintainerHref && (
            <TextLink href={readiness.maintainerHref} external>
              <Trans i18nKey="plugins.install-readiness.maintainer" values={{ name }}>
                Maintainer ({{ name }})
              </Trans>
            </TextLink>
          )}
        </Stack>
      )}
    </Stack>
  );
}

export function InstallReadinessIndicator({ plugin, latestCompatibleVersion, isRemotePluginsAvailable }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const readiness = getInstallReadiness(plugin, latestCompatibleVersion, isRemotePluginsAvailable);
  const badge = STATUS_BADGE[readiness.status];
  const label = getStatusLabel(readiness.status);

  useEffect(() => {
    if (plugin.isInstalled || readiness.status === 'ready' || !readiness.blockerReason) {
      return;
    }

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      blocker_reason: readiness.blockerReason,
      readiness_status: readiness.status,
    });
  }, [
    location.pathname,
    plugin.id,
    plugin.isInstalled,
    plugin.type,
    readiness.blockerReason,
    readiness.status,
  ]);

  return (
    <Toggletip
      title={t('plugins.install-readiness.title', 'Install readiness')}
      content={<InstallReadinessDetails readiness={readiness} />}
      placement="bottom-end"
      fitContent
    >
      <button
        type="button"
        className={styles.trigger}
        data-testid="install-readiness-indicator"
        data-readiness-status={readiness.status}
        aria-label={t('plugins.install-readiness.aria-label', 'Plugin readiness: {{status}}', { status: label })}
      >
        <Badge text={label} color={badge.color} icon={badge.icon} />
      </button>
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 0,
    borderRadius: theme.shape.radius.default,
  }),
});
