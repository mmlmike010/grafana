import { css } from '@emotion/css';

import { Trans, t } from '@grafana/i18n';
import { Badge, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import { PluginTabIds, type CatalogPlugin, type InstallReadiness, type InstallReadinessBlockReason } from '../types';

interface Props {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
}

export function InstallReadinessIndicator({ plugin, readiness }: Props) {
  const styles = useStyles2(getStyles);
  const display = getReadinessDisplay(readiness);

  return (
    <Toggletip
      title={t('plugins.install-readiness.title', 'Install readiness')}
      content={<InstallReadinessDetails plugin={plugin} readiness={readiness} />}
      placement="bottom-end"
      fitContent
    >
      <button
        type="button"
        className={styles.trigger}
        data-testid="plugin-install-readiness"
        data-status={readiness.status}
        aria-label={t('plugins.install-readiness.aria-label', 'Plugin readiness: {{status}}', {
          status: display.text,
        })}
      >
        <Badge text={display.text} color={display.color} icon={display.icon} />
      </button>
    </Toggletip>
  );
}

function InstallReadinessDetails({ plugin, readiness }: Props) {
  const reason = getPrimaryReasonMessage(readiness);
  const compatibleVersion = readiness.latestCompatibleVersion?.version;
  const grafanaDependency = readiness.grafanaDependency;
  const changelogHref = readiness.changelogAvailable ? `/plugins/${plugin.id}?page=${PluginTabIds.CHANGELOG}` : undefined;
  const signatureLabel = getSignatureLabel(readiness);
  const compatibleVersionLabel = compatibleVersion
    ? grafanaDependency
      ? t(
          'plugins.install-readiness.compatible-version-with-dep',
          'Compatible version: {{version}} ({{grafanaDependency}})',
          { version: compatibleVersion, grafanaDependency }
        )
      : t('plugins.install-readiness.compatible-version', 'Compatible version: {{version}}', {
          version: compatibleVersion,
        })
    : t('plugins.install-readiness.no-compatible-version', 'No compatible version is available for this Grafana.');

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall">{reason}</Text>
      <Text variant="bodySmall">{compatibleVersionLabel}</Text>
      <Text variant="bodySmall">
        {t('plugins.install-readiness.signature', 'Signature: {{signature}}', { signature: signatureLabel })}
      </Text>
      <Stack gap={2} wrap="wrap">
        {changelogHref && (
          <TextLink href={changelogHref}>
            <Trans i18nKey="plugins.install-readiness.changelog">Changelog</Trans>
          </TextLink>
        )}
        {readiness.orgUrl ? (
          <TextLink href={readiness.orgUrl} external>
            {readiness.orgName || t('plugins.install-readiness.maintainer', 'Maintainer')}
          </TextLink>
        ) : (
          readiness.orgName && (
            <Text variant="bodySmall">
              {t('plugins.install-readiness.maintainer-name', 'Maintainer: {{orgName}}', {
                orgName: readiness.orgName,
              })}
            </Text>
          )
        )}
        {readiness.sourceUrl && (
          <TextLink href={readiness.sourceUrl} external>
            <Trans i18nKey="plugins.install-readiness.source">Source</Trans>
          </TextLink>
        )}
      </Stack>
    </Stack>
  );
}

function getReadinessDisplay(readiness: InstallReadiness): {
  text: string;
  color: 'green' | 'orange' | 'red';
  icon: 'check' | 'exclamation-triangle' | 'times';
} {
  switch (readiness.status) {
    case 'ready':
      return {
        text: t('plugins.install-readiness.status.ready', 'Ready'),
        color: 'green',
        icon: 'check',
      };
    case 'warning':
      return {
        text: t('plugins.install-readiness.status.warning', 'Warning'),
        color: 'orange',
        icon: 'exclamation-triangle',
      };
    case 'blocked':
      return {
        text: t('plugins.install-readiness.status.blocked', 'Blocked'),
        color: 'red',
        icon: 'times',
      };
    default: {
      const _exhaustive: never = readiness;
      return _exhaustive;
    }
  }
}

function getPrimaryReasonMessage(readiness: InstallReadiness): string {
  switch (readiness.status) {
    case 'ready':
      return t(
        'plugins.install-readiness.reason.ready',
        'This plugin is compatible with this Grafana and has a valid signature.'
      );
    case 'warning':
      return readiness.warningReason === 'invalid_signature'
        ? t(
            'plugins.install-readiness.reason.invalid-signature',
            'This plugin has an invalid or modified signature. Review before installing.'
          )
        : t(
            'plugins.install-readiness.reason.unsigned-signature',
            'This plugin is unsigned. Review before installing.'
          );
    case 'blocked':
      return getBlockReasonMessage(readiness.reasons[0]);
    default: {
      const _exhaustive: never = readiness;
      return _exhaustive;
    }
  }
}

function getBlockReasonMessage(reason: InstallReadinessBlockReason): string {
  switch (reason) {
    case 'renderer':
      return t(
        'plugins.install-readiness.reason.renderer',
        'Renderer plugins cannot be managed from the plugin catalog.'
      );
    case 'enterprise_unlicensed':
      return t(
        'plugins.install-readiness.reason.enterprise-unlicensed',
        'This plugin is only available in Grafana Cloud and Grafana Enterprise.'
      );
    case 'dev_build':
      return t(
        'plugins.install-readiness.reason.dev-build',
        'Development builds cannot be managed from the plugin catalog.'
      );
    case 'unpublished':
      return t('plugins.install-readiness.reason.unpublished', 'This plugin is not published to grafana.com.');
    case 'no_permission':
      return t('plugins.install-readiness.reason.no-permission', 'You do not have permission to install plugins.');
    case 'no_compatible_version':
      return t(
        'plugins.install-readiness.reason.no-compatible-version',
        'No version of this plugin is compatible with this Grafana.'
      );
    case 'remote_catalog_unavailable':
      return t(
        'plugins.install-readiness.reason.remote-catalog-unavailable',
        'The plugin catalog is currently unavailable.'
      );
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

function getSignatureLabel(readiness: InstallReadiness): string {
  switch (readiness.signature.kind) {
    case 'core':
      return t('plugins.install-readiness.signature.core', 'Core');
    case 'valid':
      return t('plugins.install-readiness.signature.valid', 'Signed');
    case 'unsigned':
      return t('plugins.install-readiness.signature.unsigned', 'Unsigned');
    case 'invalid':
      return t('plugins.install-readiness.signature.invalid', 'Invalid');
    default: {
      const _exhaustive: never = readiness.signature;
      return _exhaustive;
    }
  }
}

const getStyles = () => ({
  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 1,
  }),
});
