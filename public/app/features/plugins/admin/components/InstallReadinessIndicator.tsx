import { css } from '@emotion/css';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, type IconName, Stack, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import { type CatalogPlugin, type InstallReadiness, PluginTabIds } from '../types';

interface Props {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
}

export function InstallReadinessIndicator({ plugin, readiness }: Props) {
  const styles = useStyles2(getStyles, readiness.status);
  const status = getStatusPresentation(readiness.status);
  const compatibilityLabel = readiness.version
    ? t('plugins.install-readiness.compatible-version', 'Compatible version {{version}}', {
        version: readiness.version,
      })
    : t('plugins.install-readiness.no-compatible-version', 'No compatible version');

  return (
    <Toggletip
      title={t('plugins.install-readiness.title', 'Install readiness')}
      placement="bottom-end"
      theme={readiness.status === 'blocked' ? 'error' : 'info'}
      content={
        <Stack direction="column" gap={1}>
          <div>
            <strong>{t('plugins.install-readiness.compatibility', 'Compatibility')}</strong>
            <div>{compatibilityLabel}</div>
            {readiness.grafanaDependency && (
              <div>
                {t('plugins.install-readiness.grafana-dependency', 'Requires Grafana {{range}}', {
                  range: readiness.grafanaDependency,
                })}
              </div>
            )}
          </div>
          <div>
            <strong>{t('plugins.install-readiness.signature', 'Signature')}</strong>
            <div>{getSignatureLabel(readiness.signature)}</div>
          </div>
          {(plugin.details?.changelog || plugin.orgUrl || plugin.url) && (
            <Stack gap={2}>
              {plugin.details?.changelog && (
                <TextLink href={`?page=${PluginTabIds.CHANGELOG}`}>
                  {t('plugins.install-readiness.changelog', 'Changelog')}
                </TextLink>
              )}
              {plugin.orgUrl && (
                <TextLink href={plugin.orgUrl} external>
                  {t('plugins.install-readiness.maintainer', 'Maintainer')}
                </TextLink>
              )}
              {plugin.url && (
                <TextLink href={plugin.url} external>
                  {t('plugins.install-readiness.source', 'Source')}
                </TextLink>
              )}
            </Stack>
          )}
        </Stack>
      }
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={t('plugins.install-readiness.aria-label', 'Install readiness: {{status}}', {
          status: status.label,
        })}
      >
        <Icon name={status.icon} size="sm" />
        {status.label}
      </button>
    </Toggletip>
  );
}

function getStatusPresentation(status: InstallReadiness['status']): { icon: IconName; label: string } {
  switch (status) {
    case 'blocked':
      return {
        icon: 'exclamation-circle',
        label: t('plugins.install-readiness.status-blocked', 'Blocked'),
      };
    case 'warning':
      return {
        icon: 'exclamation-triangle',
        label: t('plugins.install-readiness.status-warning', 'Review'),
      };
    default:
      return {
        icon: 'check-circle',
        label: t('plugins.install-readiness.status-ready', 'Ready'),
      };
  }
}

function getSignatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature-invalid', 'Invalid signature');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature-modified', 'Signed, but modified');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature-missing', 'Unsigned');
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature-internal', 'Grafana built-in');
    default:
      return t('plugins.install-readiness.signature-valid', 'Signed and verified');
  }
}

const getStyles = (theme: GrafanaTheme2, status: InstallReadiness['status']) => {
  const colors = {
    ready: {
      background: theme.colors.success.transparent,
      border: theme.colors.success.border,
      text: theme.colors.success.text,
    },
    warning: {
      background: theme.colors.warning.transparent,
      border: theme.colors.warning.border,
      text: theme.colors.warning.text,
    },
    blocked: {
      background: theme.colors.error.transparent,
      border: theme.colors.error.border,
      text: theme.colors.error.text,
    },
  }[status];

  return {
    trigger: css({
      alignItems: 'center',
      background: colors.background,
      border: `1px solid ${colors.border}`,
      borderRadius: theme.shape.radius.sm,
      color: colors.text,
      cursor: 'pointer',
      display: 'inline-flex',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      gap: theme.spacing(0.5),
      lineHeight: theme.typography.bodySmall.lineHeight,
      padding: theme.spacing(0.25, 0.75),

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
  };
};
