import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Icon, PopoverController, Spinner, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { InstallReadinessStatus, type CatalogPlugin, type InstallReadiness, PluginTabIds } from '../../types';
import { trackPluginInstallDeflected } from '../../tracking';

type Props = {
  plugin: CatalogPlugin;
  readiness: InstallReadiness;
  pluginStatus?: string;
};

export function InstallReadinessIndicator({ plugin, readiness, pluginStatus }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const hasTrackedDeflection = useRef(false);

  useEffect(() => {
    if (
      hasTrackedDeflection.current ||
      readiness.isLoading ||
      !readiness.isDeflected ||
      readiness.status === InstallReadinessStatus.Ready
    ) {
      return;
    }

    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      readiness_status: readiness.status,
      readiness_reason: readiness.reason,
      plugin_status: pluginStatus,
      latest_compatible_version: readiness.latestCompatibleVersion?.version,
      grafana_dependency: readiness.grafanaDependency,
    });
    hasTrackedDeflection.current = true;
  }, [location.pathname, plugin.id, plugin.type, pluginStatus, readiness]);

  if (readiness.isLoading) {
    return (
      <div className={styles.loading} data-testid="install-readiness-indicator">
        <Spinner inline size="sm" />
      </div>
    );
  }

  const { color, icon, label } = getReadinessPresentation(readiness);

  const changelogHref = readiness.links.hasChangelog
    ? `${location.pathname}?page=${PluginTabIds.CHANGELOG}`
    : undefined;

  const popoverContent = (
    <Stack direction="column" gap={1} maxWidth={320}>
      <Text variant="bodySmall">{getReadinessDescription(readiness)}</Text>
      {readiness.latestCompatibleVersion?.version && (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="plugins.install-readiness.compatible-version" values={{ version: readiness.latestCompatibleVersion.version }}>
            Compatible version: {{ version: readiness.latestCompatibleVersion.version }}
          </Trans>
        </Text>
      )}
      {readiness.grafanaDependency && (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="plugins.install-readiness.grafana-dependency" values={{ dependency: readiness.grafanaDependency }}>
            Requires Grafana {{ dependency: readiness.grafanaDependency }}
          </Trans>
        </Text>
      )}
      <Text variant="bodySmall" color="secondary">
        {getSignatureLabel(readiness.signature)}
      </Text>
      <Stack direction="column" gap={0.5}>
        {changelogHref && (
          <TextLink href={changelogHref}>
            <Trans i18nKey="plugins.install-readiness.view-changelog">View changelog</Trans>
          </TextLink>
        )}
        {readiness.links.repositoryUrl && (
          <TextLink href={readiness.links.repositoryUrl} external>
            <Trans i18nKey="plugins.install-readiness.view-repository">View repository</Trans>
          </TextLink>
        )}
        {readiness.links.documentationUrl && (
          <TextLink href={readiness.links.documentationUrl} external>
            <Trans i18nKey="plugins.install-readiness.view-documentation">View documentation</Trans>
          </TextLink>
        )}
        {readiness.links.maintainerUrl && readiness.links.maintainerUrl !== readiness.links.repositoryUrl && (
          <TextLink href={readiness.links.maintainerUrl} external>
            <Trans i18nKey="plugins.install-readiness.view-maintainer" values={{ org: plugin.orgName }}>
              Maintainer: {{ org: plugin.orgName }}
            </Trans>
          </TextLink>
        )}
        {readiness.links.catalogUrl && (
          <TextLink href={readiness.links.catalogUrl} external>
            <Trans i18nKey="plugins.install-readiness.view-catalog">View on Grafana.com</Trans>
          </TextLink>
        )}
      </Stack>
    </Stack>
  );

  return (
    <PopoverController content={popoverContent} hideAfter={300}>
      {({ showPopper, hidePopper, popperRef, updatePopperPosition }) => (
        <div
          ref={popperRef}
          onMouseEnter={(event) => {
            showPopper(event, event.currentTarget);
            updatePopperPosition();
          }}
          onMouseLeave={hidePopper}
          onFocus={(event) => {
            showPopper(event, event.currentTarget);
            updatePopperPosition();
          }}
          onBlur={hidePopper}
          className={styles.trigger}
          data-testid="install-readiness-indicator"
        >
          <Badge
            color={color}
            icon={icon}
            text={
              <span className={styles.badgeText}>
                {label}
                <Icon name="angle-down" size="xs" className={styles.chevron} />
              </span>
            }
          />
        </div>
      )}
    </PopoverController>
  );
}

function getReadinessPresentation(readiness: InstallReadiness) {
  switch (readiness.status) {
    case InstallReadinessStatus.Blocked:
      return {
        color: 'red' as const,
        icon: 'exclamation-triangle' as const,
        label: t('plugins.install-readiness.label-blocked', 'Blocked'),
      };
    case InstallReadinessStatus.Warning:
      return {
        color: 'orange' as const,
        icon: 'exclamation-triangle' as const,
        label: t('plugins.install-readiness.label-warning', 'Warning'),
      };
    default:
      return {
        color: 'green' as const,
        icon: 'check' as const,
        label: t('plugins.install-readiness.label-ready', 'Ready'),
      };
  }
}

function getReadinessDescription(readiness: InstallReadiness): string {
  switch (readiness.reason) {
    case 'renderer':
      return t(
        'plugins.install-readiness.description-renderer',
        'Renderer plugins cannot be managed by the Plugin Catalog.'
      );
    case 'enterprise':
      return t(
        'plugins.install-readiness.description-enterprise',
        'This plugin is only available in Grafana Cloud and Grafana Enterprise.'
      );
    case 'dev':
      return t(
        'plugins.install-readiness.description-dev',
        "This is a development build of the plugin and can't be uninstalled."
      );
    case 'missing_permission':
      return t('plugins.install-readiness.description-missing-permission', 'You do not have permission to install this plugin.');
    case 'not_published':
      return t(
        'plugins.install-readiness.description-not-published',
        "This plugin is not published to grafana.com/plugins and can't be managed via the catalog."
      );
    case 'incompatible':
      return t(
        'plugins.install-readiness.description-incompatible',
        "This plugin doesn't support your version of Grafana."
      );
    case 'remote_unavailable':
      return t(
        'plugins.install-readiness.description-remote-unavailable',
        'Install controls are disabled because the Grafana server cannot access grafana.com.'
      );
    case 'core':
      return t('plugins.install-readiness.description-core', 'Core plugins cannot be installed from the catalog.');
    case 'disabled':
      return t('plugins.install-readiness.description-disabled', 'This plugin is disabled and cannot be installed.');
    case 'provisioned':
      return t('plugins.install-readiness.description-provisioned', 'Provisioned plugins cannot be modified from the catalog.');
    case 'install_controls_disabled':
      return t('plugins.install-readiness.description-install-controls-disabled', 'Plugin install controls are disabled.');
    case 'signature_missing':
      return t(
        'plugins.install-readiness.description-signature-missing',
        'This plugin does not have a valid digital signature.'
      );
    case 'signature_invalid':
      return t(
        'plugins.install-readiness.description-signature-invalid',
        'This plugin has an invalid digital signature.'
      );
    case 'signature_modified':
      return t(
        'plugins.install-readiness.description-signature-modified',
        'This plugin signature has been modified since signing.'
      );
    default:
      return t(
        'plugins.install-readiness.description-ready',
        'This plugin is compatible with your Grafana version and ready to install.'
      );
  }
}

function getSignatureLabel(signature: PluginSignatureStatus): string {
  switch (signature) {
    case PluginSignatureStatus.valid:
      return t('plugins.install-readiness.signature-valid', 'Signature: signed');
    case PluginSignatureStatus.internal:
      return t('plugins.install-readiness.signature-internal', 'Signature: core plugin');
    case PluginSignatureStatus.missing:
      return t('plugins.install-readiness.signature-missing', 'Signature: unsigned');
    case PluginSignatureStatus.invalid:
      return t('plugins.install-readiness.signature-invalid', 'Signature: invalid');
    case PluginSignatureStatus.modified:
      return t('plugins.install-readiness.signature-modified', 'Signature: modified');
    default:
      return t('plugins.install-readiness.signature-unknown', 'Signature: unknown');
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    cursor: 'pointer',
    display: 'inline-flex',
  }),
  badgeText: css({
    alignItems: 'center',
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
  chevron: css({
    marginLeft: theme.spacing(0.25),
  }),
  loading: css({
    alignItems: 'center',
    display: 'inline-flex',
    minHeight: theme.spacing(4),
  }),
});
