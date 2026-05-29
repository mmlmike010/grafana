import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, type IconName, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { type InstallReadiness, InstallReadinessBlockerReason } from '../helpers';
import { type CatalogPlugin, PluginTabIds } from '../types';

interface Props {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
  // The path of the plugin details page, used to build the changelog tab link.
  pathname?: string;
}

export function InstallReadinessCard({ plugin, readiness, pathname }: Props) {
  const styles = useStyles2(getStyles);
  const { canInstall, blockerReason, isCompatible, latestCompatibleVersion, grafanaDependency, signatureState } =
    readiness;

  const grafanaVersion = config.buildInfo.version;
  const changelogHref = plugin.details?.changelog
    ? `${pathname ?? `/plugins/${plugin.id}`}?page=${PluginTabIds.CHANGELOG}`
    : undefined;
  const maintainerHref = plugin.orgUrl || plugin.details?.repositoryUrl;
  const sourceHref = plugin.details?.repositoryUrl;

  return (
    <div className={styles.card} data-testid="plugin-install-readiness">
      <Text element="h3" variant="bodySmall" weight="bold" color="secondary">
        <Trans i18nKey="plugins.install-readiness-card.title">Install readiness</Trans>
      </Text>

      <Stack direction="column" gap={1}>
        {/* Grafana version compatibility */}
        <ReadinessRow
          icon={isCompatible ? 'check-circle' : 'exclamation-triangle'}
          tone={isCompatible ? 'success' : 'warning'}
        >
          {isCompatible ? (
            <Stack direction="column" gap={0}>
              <Text variant="bodySmall">
                <Trans
                  i18nKey="plugins.install-readiness-card.compatible"
                  values={{ version: latestCompatibleVersion ?? '' }}
                >
                  Compatible version {'{{version}}'} available
                </Trans>
              </Text>
              {grafanaDependency && (
                <Text variant="bodySmall" color="secondary">
                  <Trans
                    i18nKey="plugins.install-readiness-card.dependency-range"
                    values={{ range: grafanaDependency }}
                  >
                    Requires Grafana {'{{range}}'}
                  </Trans>
                </Text>
              )}
            </Stack>
          ) : (
            <Text variant="bodySmall">
              <Trans
                i18nKey="plugins.install-readiness-card.incompatible"
                values={{ version: grafanaVersion }}
              >
                No version compatible with Grafana {'{{version}}'}
              </Trans>
            </Text>
          )}
        </ReadinessRow>

        {/* Signature posture */}
        <ReadinessRow icon={signatureIcon(signatureState)} tone={signatureTone(signatureState)}>
          <Text variant="bodySmall">{signatureLabel(signatureState)}</Text>
        </ReadinessRow>

        {/* Blocker reason */}
        {!canInstall && blockerReason && (
          <ReadinessRow icon="lock" tone="warning">
            <Text variant="bodySmall">{blockerReasonLabel(blockerReason)}</Text>
          </ReadinessRow>
        )}
      </Stack>

      {/* Changelog & maintainer/source links */}
      {(changelogHref || maintainerHref || sourceHref) && (
        <Stack direction="row" gap={2} wrap="wrap">
          {changelogHref && (
            <TextLink href={changelogHref} variant="bodySmall" icon="list-ul">
              {t('plugins.install-readiness-card.changelog', 'Changelog')}
            </TextLink>
          )}
          {maintainerHref && (
            <TextLink href={maintainerHref} external variant="bodySmall" icon="building">
              {t('plugins.install-readiness-card.maintainer', 'Maintainer')}
            </TextLink>
          )}
          {sourceHref && (
            <TextLink href={sourceHref} external variant="bodySmall" icon="github">
              {t('plugins.install-readiness-card.source', 'Source')}
            </TextLink>
          )}
        </Stack>
      )}
    </div>
  );
}

interface ReadinessRowProps {
  icon: IconName;
  tone: 'success' | 'warning';
  children: React.ReactNode;
}

function ReadinessRow({ icon, tone, children }: ReadinessRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" gap={1} alignItems="flex-start">
      <Icon name={icon} className={tone === 'success' ? styles.success : styles.warning} />
      {children}
    </Stack>
  );
}

function signatureIcon(state: InstallReadiness['signatureState']): IconName {
  switch (state) {
    case 'signed':
    case 'internal':
      return 'check-circle';
    case 'invalid':
      return 'exclamation-triangle';
    case 'unsigned':
    default:
      return 'shield-exclamation';
  }
}

function signatureTone(state: InstallReadiness['signatureState']): 'success' | 'warning' {
  return state === 'signed' || state === 'internal' ? 'success' : 'warning';
}

function signatureLabel(state: InstallReadiness['signatureState']): string {
  switch (state) {
    case 'signed':
      return t('plugins.install-readiness-card.signature-signed', 'Signed plugin');
    case 'internal':
      return t('plugins.install-readiness-card.signature-internal', 'Core (internal) plugin');
    case 'invalid':
      return t('plugins.install-readiness-card.signature-invalid', 'Invalid plugin signature');
    case 'unsigned':
    default:
      return t('plugins.install-readiness-card.signature-unsigned', 'Unsigned plugin');
  }
}

function blockerReasonLabel(reason: InstallReadinessBlockerReason): string {
  switch (reason) {
    case InstallReadinessBlockerReason.RendererUnsupported:
      return t(
        'plugins.install-readiness-card.blocker-renderer',
        'Renderer plugins cannot be managed by the Plugin Catalog.'
      );
    case InstallReadinessBlockerReason.EnterpriseUnlicensed:
      return t(
        'plugins.install-readiness-card.blocker-enterprise',
        'This plugin requires a Grafana Enterprise or Cloud license.'
      );
    case InstallReadinessBlockerReason.DevBuild:
      return t('plugins.install-readiness-card.blocker-dev', 'This is a development build and cannot be managed.');
    case InstallReadinessBlockerReason.NoPermission:
      return t(
        'plugins.install-readiness-card.blocker-permission',
        'You do not have permission to install this plugin.'
      );
    case InstallReadinessBlockerReason.NotPublished:
      return t(
        'plugins.install-readiness-card.blocker-not-published',
        'This plugin is not published to grafana.com and cannot be installed via the catalog.'
      );
    case InstallReadinessBlockerReason.IncompatibleVersion:
      return t(
        'plugins.install-readiness-card.blocker-incompatible',
        'No compatible version is available for your Grafana version.'
      );
    case InstallReadinessBlockerReason.RemoteUnavailable:
      return t(
        'plugins.install-readiness-card.blocker-remote-unavailable',
        'Install controls are disabled because Grafana cannot reach grafana.com.'
      );
    case InstallReadinessBlockerReason.InvalidSignature:
      return t(
        'plugins.install-readiness-card.blocker-invalid-signature',
        'This plugin has an invalid signature and cannot be installed.'
      );
    default:
      return t('plugins.install-readiness-card.blocker-generic', 'This plugin cannot be installed.');
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  success: css({
    color: theme.colors.success.text,
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  }),
  warning: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  }),
});
