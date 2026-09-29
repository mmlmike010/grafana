import { css } from '@emotion/css';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, type BadgeColor, type IconName, Stack, Text, TextLink, Toggletip, useStyles2 } from '@grafana/ui';

import { type InstallReadiness, type InstallReadinessStatus } from '../helpers';
import { PluginTabIds } from '../types';

type Props = {
  readiness: InstallReadiness;
};

export function InstallReadinessIndicator({ readiness }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const { color, icon, label } = getIndicatorAppearance(readiness);
  const changelogHref = readiness.changelogAvailable
    ? `${location.pathname}?page=${PluginTabIds.CHANGELOG}`
    : undefined;

  return (
    <Toggletip
      title={t('plugins.install-readiness.title', 'Install readiness')}
      content={<InstallReadinessDetails readiness={readiness} changelogHref={changelogHref} />}
      placement="bottom-end"
      fitContent
    >
      <button
        type="button"
        className={styles.trigger}
        data-testid="plugin-install-readiness"
        aria-label={t('plugins.install-readiness.aria-label', 'Install readiness: {{label}}', { label })}
      >
        <Badge color={color} icon={icon} text={label} />
      </button>
    </Toggletip>
  );
}

function InstallReadinessDetails({
  readiness,
  changelogHref,
}: {
  readiness: InstallReadiness;
  changelogHref?: string;
}) {
  return (
    <Stack direction="column" gap={1}>
      {readiness.compatibleVersion && (
        <Text variant="bodySmall">
          <Trans
            i18nKey="plugins.install-readiness.compatible-version"
            values={{ version: readiness.compatibleVersion }}
          >
            Compatible version: {{ version: readiness.compatibleVersion }}
          </Trans>
        </Text>
      )}
      {readiness.grafanaDependency && (
        <Text variant="bodySmall">
          <Trans i18nKey="plugins.install-readiness.grafana-dependency" values={{ range: readiness.grafanaDependency }}>
            Grafana: {{ range: readiness.grafanaDependency }}
          </Trans>
        </Text>
      )}
      <Text variant="bodySmall">
        <Trans
          i18nKey="plugins.install-readiness.signature"
          values={{ status: getSignatureLabel(readiness.signature) }}
        >
          Signature: {{ status: getSignatureLabel(readiness.signature) }}
        </Trans>
      </Text>
      {changelogHref && (
        <TextLink href={changelogHref} inline={false}>
          <Trans i18nKey="plugins.install-readiness.changelog">Changelog</Trans>
        </TextLink>
      )}
      {readiness.maintainerUrl && (
        <TextLink href={readiness.maintainerUrl} external inline={false}>
          <Trans
            i18nKey="plugins.install-readiness.maintainer"
            values={{ name: readiness.maintainerName || readiness.maintainerUrl }}
          >
            Maintainer: {{ name: readiness.maintainerName || readiness.maintainerUrl }}
          </Trans>
        </TextLink>
      )}
    </Stack>
  );
}

function getIndicatorAppearance(readiness: InstallReadiness): {
  color: BadgeColor;
  icon: IconName;
  label: string;
} {
  const statusColor: Record<InstallReadinessStatus, BadgeColor> = {
    ready: 'green',
    warning: 'orange',
    blocked: 'red',
  };
  const statusIcon: Record<InstallReadinessStatus, IconName> = {
    ready: 'check-circle',
    warning: 'exclamation-triangle',
    blocked: 'times-circle',
  };

  return {
    color: statusColor[readiness.status],
    icon: statusIcon[readiness.status],
    label: getStatusLabel(readiness),
  };
}

function getStatusLabel(readiness: InstallReadiness): string {
  switch (readiness.blockerReason) {
    case 'incompatible':
      return t('plugins.install-readiness.status.incompatible', 'Incompatible');
    case 'unsigned':
      return t('plugins.install-readiness.status.unsigned', 'Unsigned');
    case 'invalid-signature':
      return t('plugins.install-readiness.status.invalid-signature', 'Invalid signature');
    case 'modified-signature':
      return t('plugins.install-readiness.status.modified-signature', 'Modified signature');
    case 'unpublished':
      return t('plugins.install-readiness.status.unpublished', 'Unpublished');
    case 'enterprise':
      return t('plugins.install-readiness.status.enterprise', 'Enterprise');
    case 'renderer':
      return t('plugins.install-readiness.status.renderer', 'Not installable');
    case 'dev':
      return t('plugins.install-readiness.status.dev', 'Dev build');
    case 'remote-unavailable':
      return t('plugins.install-readiness.status.remote-unavailable', 'Unavailable');
    case 'no-permission':
      return t('plugins.install-readiness.status.no-permission', 'No permission');
    default:
      return t('plugins.install-readiness.status.ready', 'Ready');
  }
}

function getSignatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.valid:
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature.signed', 'Signed');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature.unsigned', 'Unsigned');
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature.invalid', 'Invalid');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature.modified', 'Modified');
    default:
      return signature;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 1,
  }),
});
