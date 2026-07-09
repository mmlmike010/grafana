import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import { type InstallReadiness, type InstallReadinessReason, type InstallReadinessStatus } from '../helpers';
import { trackPluginInstallDeflected } from '../tracking';
import { type CatalogPlugin, PluginTabIds } from '../types';

type Props = {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
};

const STATUS_DISPLAY: Record<
  InstallReadinessStatus,
  { color: 'green' | 'orange' | 'red'; icon: 'check' | 'exclamation-triangle' }
> = {
  ready: { color: 'green', icon: 'check' },
  warning: { color: 'orange', icon: 'exclamation-triangle' },
  blocked: { color: 'red', icon: 'exclamation-triangle' },
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

function getReasonMessage(reason: InstallReadinessReason): string {
  switch (reason) {
    case 'incompatible':
      return t(
        'plugins.install-readiness.reason-incompatible',
        'No version is compatible with this Grafana instance.'
      );
    case 'unsigned':
      return t('plugins.install-readiness.reason-unsigned', 'This plugin is unsigned.');
    case 'invalid_signature':
      return t('plugins.install-readiness.reason-invalid-signature', 'Plugin signature is invalid.');
    case 'modified_signature':
      return t('plugins.install-readiness.reason-modified-signature', 'Plugin signature has been modified.');
    case 'unpublished':
      return t('plugins.install-readiness.reason-unpublished', 'This plugin is not published to the catalog.');
    case 'no_permission':
      return t('plugins.install-readiness.reason-no-permission', 'You do not have permission to install plugins.');
    case 'enterprise_unlicensed':
      return t(
        'plugins.install-readiness.reason-enterprise-unlicensed',
        'An Enterprise license is required to install this plugin.'
      );
    case 'dev_plugin':
      return t('plugins.install-readiness.reason-dev-plugin', 'This is a development build of the plugin.');
    case 'renderer':
      return t(
        'plugins.install-readiness.reason-renderer',
        'Renderer plugins cannot be managed from the catalog.'
      );
    case 'remote_unavailable':
      return t(
        'plugins.install-readiness.reason-remote-unavailable',
        'The plugin catalog is currently unavailable.'
      );
  }
}

function getSignatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.valid:
      return t('plugins.install-readiness.signature-valid', 'Signed');
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature-internal', 'Core');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature-missing', 'Unsigned');
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature-invalid', 'Invalid signature');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature-modified', 'Modified signature');
  }
}

export function InstallReadinessIndicator({ plugin, readiness }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const trackedKey = useRef<string | null>(null);
  const display = STATUS_DISPLAY[readiness.status];
  const label = getStatusLabel(readiness.status);
  const primaryReason = readiness.reasons[0];
  const changelogHref = readiness.hasChangelog
    ? `${location.pathname}?page=${PluginTabIds.CHANGELOG}`
    : undefined;

  useEffect(() => {
    if (readiness.status === 'ready' || !primaryReason) {
      return;
    }

    const key = `${plugin.id}:${readiness.status}:${primaryReason}`;
    if (trackedKey.current === key) {
      return;
    }
    trackedKey.current = key;

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      readiness_status: readiness.status,
      blocker_reason: primaryReason,
      blocker_reasons: readiness.reasons,
    });
  }, [plugin.id, plugin.type, location.pathname, readiness.status, readiness.reasons, primaryReason]);

  const tooltip = primaryReason
    ? getReasonMessage(primaryReason)
    : t('plugins.install-readiness.tooltip-ready', 'Compatible and signed — ready to install.');

  const detailsContent = (
    <Stack direction="column" gap={1}>
      {readiness.reasons.length > 0 ? (
        readiness.reasons.map((reason) => (
          <Text key={reason} variant="bodySmall">
            {getReasonMessage(reason)}
          </Text>
        ))
      ) : (
        <Text variant="bodySmall">
          <Trans i18nKey="plugins.install-readiness.details-ready">
            Compatible and signed — ready to install.
          </Trans>
        </Text>
      )}

      {readiness.latestCompatibleVersion && (
        <Text variant="bodySmall" color="secondary">
          <Trans
            i18nKey="plugins.install-readiness.compatible-version"
            values={{ version: readiness.latestCompatibleVersion.version }}
          >
            Compatible version: {'{{version}}'}
          </Trans>
        </Text>
      )}

      {readiness.grafanaDependency && (
        <Text variant="bodySmall" color="secondary">
          <Trans
            i18nKey="plugins.install-readiness.grafana-dependency"
            values={{ dependency: readiness.grafanaDependency }}
          >
            Grafana dependency: {'{{dependency}}'}
          </Trans>
        </Text>
      )}

      <Text variant="bodySmall" color="secondary">
        <Trans
          i18nKey="plugins.install-readiness.signature-status"
          values={{ status: getSignatureLabel(readiness.signature) }}
        >
          Signature: {'{{status}}'}
        </Trans>
      </Text>

      {(changelogHref || readiness.orgUrl) && (
        <Stack gap={2}>
          {changelogHref && (
            <TextLink href={changelogHref} inline={false}>
              <Trans i18nKey="plugins.install-readiness.changelog-link">Changelog</Trans>
            </TextLink>
          )}
          {readiness.orgUrl && (
            <TextLink href={readiness.orgUrl} external inline={false}>
              <Trans
                i18nKey="plugins.install-readiness.maintainer-link"
                values={{
                  orgName: readiness.orgName || t('plugins.install-readiness.maintainer', 'Maintainer'),
                }}
              >
                {'{{orgName}}'}
              </Trans>
            </TextLink>
          )}
        </Stack>
      )}
    </Stack>
  );

  const badge = (
    <Badge
      text={label}
      color={display.color}
      icon={display.icon}
      data-testid="plugin-install-readiness-indicator"
    />
  );

  return (
    <Toggletip
      title={t('plugins.install-readiness.details-title', 'Install readiness')}
      content={detailsContent}
      placement="bottom-end"
      fitContent
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={t('plugins.install-readiness.aria-label', 'Install readiness: {{status}}', {
          status: label,
        })}
        title={tooltip}
      >
        {badge}
      </button>
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    background: 'none',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 2,
    },
  }),
});
