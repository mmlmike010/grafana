import { css } from '@emotion/css';
import { useEffect } from 'react';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Badge, type BadgeColor, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import { type InstallReadiness } from '../helpers';
import { trackPluginInstallDeflected } from '../tracking';
import { type CatalogPlugin, PluginTabIds } from '../types';

type Props = {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
};

function getBadgeColor(status: InstallReadiness['status']): BadgeColor {
  switch (status) {
    case 'ready':
      return 'green';
    case 'warning':
      return 'orange';
    case 'blocked':
      return 'red';
  }
}

function getBadgeIcon(status: InstallReadiness['status']): 'check' | 'exclamation-triangle' | 'times' {
  switch (status) {
    case 'ready':
      return 'check';
    case 'warning':
      return 'exclamation-triangle';
    case 'blocked':
      return 'times';
  }
}

function signatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.valid:
      return t('plugins.install-readiness.signature-valid', 'Signed');
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature-core', 'Core');
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature-invalid', 'Invalid');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature-modified', 'Modified');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature-missing', 'Missing');
    default:
      return t('plugins.install-readiness.signature-unsigned', 'Unsigned');
  }
}

export function InstallReadinessIndicator({ plugin, readiness }: Props) {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!readiness.shouldTrackDeflection) {
      return;
    }

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: locationService.getLocation().pathname,
      reason: readiness.reason,
      status: readiness.status,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
  }, [plugin.id, plugin.type, readiness.reason, readiness.shouldTrackDeflection, readiness.status]);

  const changelogHref = readiness.hasChangelog
    ? `${locationService.getLocation().pathname}?page=${PluginTabIds.CHANGELOG}`
    : undefined;
  const maintainerHref = readiness.orgUrl || readiness.repositoryUrl;

  const tooltip = (
    <Stack direction="column" gap={0.5}>
      <Text variant="bodySmall" weight="medium">
        {readiness.label}
      </Text>
      {readiness.latestCompatibleVersion && (
        <Text variant="bodySmall" color="secondary">
          {t('plugins.install-readiness.compatible-version', 'Compatible version: {{version}}', {
            version: readiness.latestCompatibleVersion.version,
          })}
        </Text>
      )}
      {readiness.grafanaDependency && (
        <Text variant="bodySmall" color="secondary">
          {t('plugins.install-readiness.grafana-dependency', 'Grafana dependency: {{dependency}}', {
            dependency: readiness.grafanaDependency,
          })}
        </Text>
      )}
      <Text variant="bodySmall" color="secondary">
        {t('plugins.install-readiness.signature-status', 'Signature: {{status}}', {
          status: signatureLabel(readiness.signature),
        })}
      </Text>
      {readiness.orgName && (
        <Text variant="bodySmall" color="secondary">
          {t('plugins.install-readiness.maintainer', 'Maintainer: {{name}}', { name: readiness.orgName })}
        </Text>
      )}
      {(changelogHref || maintainerHref) && (
        <Stack direction="row" gap={1} wrap="wrap">
          {changelogHref && (
            <TextLink href={changelogHref} inline={false} className={styles.link}>
              {t('plugins.install-readiness.changelog', 'Changelog')}
            </TextLink>
          )}
          {maintainerHref && (
            <TextLink href={maintainerHref} external inline={false} className={styles.link}>
              {t('plugins.install-readiness.source', 'Source')}
            </TextLink>
          )}
        </Stack>
      )}
    </Stack>
  );

  return (
    <div className={styles.container} data-testid="plugin-install-readiness">
      <Toggletip content={tooltip} fitContent placement="bottom-end">
        <button
          type="button"
          className={styles.trigger}
          aria-label={t('plugins.install-readiness.aria-label', 'Install readiness: {{label}}', {
            label: readiness.label,
          })}
        >
          <Badge text={readiness.label} color={getBadgeColor(readiness.status)} icon={getBadgeIcon(readiness.status)} />
        </button>
      </Toggletip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'center',
  }),
  trigger: css({
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
  }),
  link: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
