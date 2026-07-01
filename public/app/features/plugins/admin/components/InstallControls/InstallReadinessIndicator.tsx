import { css } from '@emotion/css';
import * as React from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Stack, TextLink, useStyles2, type BadgeColor } from '@grafana/ui';

import { PluginTabIds } from '../../types';
import { type InstallReadinessResult, InstallReadinessSeverity } from '../../types';

interface Props {
  readiness: InstallReadinessResult;
  pluginName: string;
}

export function InstallReadinessIndicator({ readiness, pluginName }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const { severity, label, latestCompatibleVersion, grafanaDependency, hasChangelog, maintainerUrl, sourceUrl } =
    readiness;

  const badgeColor = getBadgeColor(severity);
  const badgeIcon = getBadgeIcon(severity, readiness.signatureStatus);
  const changelogUrl = hasChangelog ? `${location.pathname}?page=${PluginTabIds.CHANGELOG}` : undefined;

  const tooltip = (
    <Stack direction="column" gap={1} className={styles.tooltip}>
      <strong>{pluginName}</strong>
      <span>{getReadinessDescription(readiness)}</span>
      {latestCompatibleVersion && (
        <span>
          <Trans i18nKey="plugins.install-readiness-indicator.compatible-version">
            Compatible version: {{ version: latestCompatibleVersion.version }}
          </Trans>
        </span>
      )}
      {grafanaDependency && (
        <span>
          <Trans i18nKey="plugins.install-readiness-indicator.grafana-dependency">
            Requires Grafana {{ dependency: grafanaDependency }}
          </Trans>
        </span>
      )}
      <Stack direction="column" gap={0.5}>
        {changelogUrl && (
          <TextLink href={changelogUrl}>
            <Trans i18nKey="plugins.install-readiness-indicator.view-changelog">View changelog</Trans>
          </TextLink>
        )}
        {sourceUrl && (
          <TextLink href={sourceUrl} external>
            <Trans i18nKey="plugins.install-readiness-indicator.view-source">View source</Trans>
          </TextLink>
        )}
        {maintainerUrl && (
          <TextLink href={maintainerUrl} external>
            <Trans i18nKey="plugins.install-readiness-indicator.view-maintainer">View maintainer</Trans>
          </TextLink>
        )}
      </Stack>
    </Stack>
  );

  return (
    <Badge
      text={label}
      color={badgeColor}
      icon={badgeIcon}
      tooltip={tooltip}
      data-testid="plugin-install-readiness-indicator"
    />
  );
}

function getBadgeColor(severity: InstallReadinessSeverity): BadgeColor {
  switch (severity) {
    case InstallReadinessSeverity.Ready:
      return 'green';
    case InstallReadinessSeverity.Warning:
      return 'orange';
    case InstallReadinessSeverity.Blocked:
      return 'red';
    default:
      return 'darkgrey';
  }
}

function getBadgeIcon(
  severity: InstallReadinessSeverity,
  signatureStatus: PluginSignatureStatus
): 'check' | 'exclamation-triangle' | 'times' | 'shield-exclamation' {
  if (severity === InstallReadinessSeverity.Ready) {
    return signatureStatus === PluginSignatureStatus.valid ? 'check' : 'shield-exclamation';
  }

  if (severity === InstallReadinessSeverity.Blocked) {
    return 'times';
  }

  return 'exclamation-triangle';
}

function getReadinessDescription(readiness: InstallReadinessResult): string {
  switch (readiness.reason) {
    case 'ready':
      return t(
        'plugins.install-readiness-indicator.description-ready',
        'This plugin is compatible with your Grafana version and ready to install.'
      );
    case 'incompatible_version':
      return t(
        'plugins.install-readiness-indicator.description-incompatible',
        "This plugin doesn't support your version of Grafana."
      );
    case 'unsigned':
      return t(
        'plugins.install-readiness-indicator.description-unsigned',
        'This plugin is unsigned. Review the maintainer and source before installing.'
      );
    case 'invalid_signature':
      return t(
        'plugins.install-readiness-indicator.description-invalid-signature',
        'This plugin has an invalid or modified signature.'
      );
    case 'remote_unavailable':
      return t(
        'plugins.install-readiness-indicator.description-remote-unavailable',
        'Install readiness cannot be verified because grafana.com is unavailable.'
      );
    case 'no_permission':
      return t(
        'plugins.install-readiness-indicator.description-no-permission',
        'You do not have permission to install this plugin.'
      );
    default:
      return t(
        'plugins.install-readiness-indicator.description-blocked',
        'Review compatibility and signature details before proceeding.'
      );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  tooltip: css({
    maxWidth: theme.spacing(40),
  }),
});
