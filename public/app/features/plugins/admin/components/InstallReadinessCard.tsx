import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PluginSignatureStatus } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Box, Icon, Stack, Text, TextLink, useTheme2 } from '@grafana/ui';

import { usePluginInstallReadinessContext } from '../hooks/usePluginInstallReadinessContext';
import { useIsRemotePluginsAvailable } from '../state/hooks';
import { trackPluginInstallDeflected, trackPluginInstallReadinessViewed } from '../tracking';
import { type CatalogPlugin } from '../types';
import {
  buildInstallReadiness,
  shouldShowInstallReadinessCard,
  type InstallReadinessBlocker,
  type InstallReadinessSummary,
} from '../utils/buildInstallReadiness';

type Props = {
  plugin: CatalogPlugin;
};

export function InstallReadinessCard({ plugin }: Props): React.ReactElement | null {
  const theme = useTheme2();
  const location = useLocation();
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const { context, isLoading } = usePluginInstallReadinessContext(plugin.id);
  const trackedDeflection = useRef(false);
  const trackedView = useRef(false);

  const isEnabled = Boolean(config.featureToggles.pluginInstallReadiness);
  const shouldShow = isEnabled && shouldShowInstallReadinessCard(plugin, isRemotePluginsAvailable);
  const summary = shouldShow
    ? buildInstallReadiness(plugin, isRemotePluginsAvailable, context)
    : undefined;

  useEffect(() => {
    if (!shouldShow || !summary || trackedView.current) {
      return;
    }
    trackedView.current = true;
    trackPluginInstallReadinessViewed({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      can_install: summary.canInstall,
      blockers: summary.blockers,
    });
  }, [location.pathname, plugin.id, plugin.type, shouldShow, summary]);

  useEffect(() => {
    if (!shouldShow || !summary || trackedDeflection.current || plugin.isInstalled || summary.canInstall) {
      return;
    }
    trackedDeflection.current = true;
    trackPluginInstallDeflected({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      blockers: summary.blockers,
    });
  }, [location.pathname, plugin.id, plugin.isInstalled, plugin.type, shouldShow, summary]);

  if (!shouldShow || (isLoading && !context)) {
    return null;
  }

  if (!summary) {
    return null;
  }

  return (
    <Box
      borderRadius="lg"
      padding={2}
      borderColor="medium"
      borderStyle="solid"
      data-testid="plugin-install-readiness-card"
    >
      <Stack direction="column" gap={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Text color="secondary" variant="h6">
            <Trans i18nKey="plugins.install-readiness.title">Install readiness</Trans>
          </Text>
          <Badge
            color={summary.canInstall ? 'green' : 'orange'}
            text={
              summary.canInstall
                ? t('plugins.install-readiness.status-ready', 'Ready')
                : t('plugins.install-readiness.status-review', 'Review required')
            }
          />
        </Stack>

        <ReadinessRow
          icon="grafana"
          label={t('plugins.install-readiness.grafana-version', 'Grafana version')}
          value={summary.grafanaVersion}
          status={summary.isCompatible ? 'ok' : 'warning'}
        />

        {summary.grafanaDependency && (
          <ReadinessRow
            icon="info-circle"
            label={t('plugins.install-readiness.required-grafana', 'Requires Grafana')}
            value={summary.grafanaDependency}
            status={summary.isCompatible ? 'ok' : 'warning'}
          />
        )}

        {summary.targetVersion && (
          <ReadinessRow
            icon="cloud-download"
            label={t('plugins.install-readiness.target-version', 'Recommended version')}
            value={summary.targetVersion}
            status={summary.isCompatible ? 'ok' : 'warning'}
          />
        )}

        <ReadinessRow
          icon="shield"
          label={t('plugins.install-readiness.signature', 'Signature')}
          value={getSignatureLabel(summary)}
          status={summary.isUnsigned ? 'warning' : 'ok'}
        />

        {summary.maintainerName && (
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Icon name="user" size="sm" />
            <Stack direction="column" gap={0.25}>
              <Text color="secondary" variant="bodySmall">
                <Trans i18nKey="plugins.install-readiness.maintainer">Maintainer</Trans>
              </Text>
              {summary.maintainerUrl ? (
                <TextLink href={summary.maintainerUrl} external>
                  {summary.maintainerName}
                </TextLink>
              ) : (
                <Text>{summary.maintainerName}</Text>
              )}
            </Stack>
          </Stack>
        )}

        <Stack direction="row" gap={2} wrap>
          {summary.hasChangelog && (
            <TextLink href={`${location.pathname}${summary.changelogPath}`}>
              <Trans i18nKey="plugins.install-readiness.view-changelog">View changelog</Trans>
            </TextLink>
          )}
          <TextLink href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" external>
            <Trans i18nKey="plugins.install-readiness.signature-docs">Signature docs</Trans>
          </TextLink>
        </Stack>

        {summary.blockers.length > 0 && (
          <Stack direction="column" gap={0.5}>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="plugins.install-readiness.blockers">Install blockers</Trans>
            </Text>
            {summary.blockers.map((blocker) => (
              <Stack key={blocker} direction="row" gap={0.5} alignItems="center">
                <Icon name="exclamation-triangle" size="sm" color={theme.colors.warning.main} />
                <Text variant="bodySmall">{blockerLabel(blocker)}</Text>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function ReadinessRow({
  icon,
  label,
  value,
  status,
}: {
  icon: string;
  label: string;
  value: string;
  status: 'ok' | 'warning';
}) {
  const theme = useTheme2();

  return (
    <Stack direction="row" gap={1} alignItems="flex-start">
      <Icon name={icon as 'grafana'} size="sm" />
      <Stack direction="column" gap={0.25} flex={1}>
        <Text color="secondary" variant="bodySmall">
          {label}
        </Text>
        <Text>{value}</Text>
      </Stack>
      <Icon
        name={status === 'ok' ? 'check-circle' : 'exclamation-triangle'}
        size="sm"
        color={status === 'ok' ? theme.colors.success.main : theme.colors.warning.main}
      />
    </Stack>
  );
}

function getSignatureLabel(summary: InstallReadinessSummary): string {
  if (summary.signatureStatus === PluginSignatureStatus.valid) {
    return t('plugins.install-readiness.signature-signed', 'Signed');
  }
  if (summary.signatureStatus === PluginSignatureStatus.internal) {
    return t('plugins.install-readiness.signature-internal', 'Core plugin');
  }
  if (summary.isUnsigned) {
    return summary.allowUnsignedPlugins
      ? t('plugins.install-readiness.signature-unsigned-allowed', 'Unsigned (allowed on this instance)')
      : t('plugins.install-readiness.signature-unsigned', 'Unsigned');
  }
  return summary.signatureStatus;
}

function blockerLabel(blocker: InstallReadinessBlocker): string {
  switch (blocker) {
    case 'incompatible_version':
      return t('plugins.install-readiness.blocker-incompatible', 'Not compatible with this Grafana version');
    case 'unsigned_plugin':
      return t('plugins.install-readiness.blocker-unsigned', 'Plugin is not signed');
    case 'no_permission':
      return t('plugins.install-readiness.blocker-permission', 'Missing permission to install plugins');
    case 'enterprise_required':
      return t('plugins.install-readiness.blocker-enterprise', 'Requires Grafana Enterprise or Cloud');
    case 'remote_unavailable':
      return t('plugins.install-readiness.blocker-remote', 'Cannot reach grafana.com plugin catalog');
    case 'unpublished':
      return t('plugins.install-readiness.blocker-unpublished', 'Plugin is not published to the catalog');
    case 'renderer_plugin':
      return t('plugins.install-readiness.blocker-renderer', 'Renderer plugins cannot be installed from the catalog');
    case 'dev_plugin':
      return t('plugins.install-readiness.blocker-dev', 'Development plugins cannot be installed from the catalog');
    default:
      return blocker;
  }
}
