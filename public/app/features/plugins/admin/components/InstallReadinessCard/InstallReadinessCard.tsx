import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PluginSignatureStatus } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Alert,
  Box,
  Icon,
  PluginSignatureBadge,
  Stack,
  Text,
  TextLink,
  useTheme2,
} from '@grafana/ui';

import { getLatestCompatibleVersion, hasInstallControlWarning } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { trackInstallDeflection, trackInstallReadinessViewed } from '../../tracking';
import { type CatalogPlugin, type PluginInstallReadiness, PluginTabIds } from '../../types';

type Props = {
  plugin: CatalogPlugin;
  readiness?: PluginInstallReadiness;
  isLoading?: boolean;
};

export function InstallReadinessCard({ plugin, readiness, isLoading }: Props) {
  const theme = useTheme2();
  const location = useLocation();
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
  const hasTrackedView = useRef(false);
  const hasTrackedDeflection = useRef(false);

  const maintainerName = readiness?.maintainerName || plugin.orgName;
  const maintainerUrl =
    readiness?.maintainerUrl ||
    (plugin.orgName ? `https://grafana.com/orgs/${plugin.orgName.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const changelogPath = readiness?.changelogPath || `${location.pathname}?page=${PluginTabIds.CHANGELOG}`;
  const grafanaDependency = readiness?.grafanaDependency || latestCompatibleVersion?.grafanaDependency || plugin.details?.grafanaDependency;
  const signatureStatus = readiness?.signature || plugin.signature || PluginSignatureStatus.missing;
  const signatureType = readiness?.signatureType || plugin.signatureType;
  const signatureOrg = readiness?.signatureOrg || plugin.signatureOrg;
  const isCompatible = readiness?.isCompatible ?? Boolean(latestCompatibleVersion);
  const isSigned = readiness?.isSigned ?? signatureStatus === PluginSignatureStatus.valid || signatureStatus === PluginSignatureStatus.internal;

  useEffect(() => {
    if (isLoading || hasTrackedView.current) {
      return;
    }

    trackInstallReadinessViewed({
      plugin_id: plugin.id,
      plugin_type: plugin.type,
      path: location.pathname,
      is_compatible: isCompatible,
      is_signed: isSigned,
      has_blockers: Boolean(readiness?.blockers?.length),
      has_warnings: Boolean(readiness?.warnings?.length) || hasInstallWarning,
    });
    hasTrackedView.current = true;

    if ((hasInstallWarning || readiness?.blockers?.length) && !hasTrackedDeflection.current) {
      trackInstallDeflection({
        plugin_id: plugin.id,
        plugin_type: plugin.type,
        path: location.pathname,
        reason: readiness?.blockers?.[0]?.id || 'install-control-warning',
      });
      hasTrackedDeflection.current = true;
    }
  }, [
    hasInstallWarning,
    isCompatible,
    isLoading,
    isSigned,
    location.pathname,
    plugin.id,
    plugin.type,
    readiness?.blockers,
    readiness?.warnings,
  ]);

  if (plugin.isCore) {
    return null;
  }

  return (
    <Stack direction="column" gap={1.5} data-testid="install-readiness-card">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Text color="secondary" variant="h6">
          <Trans i18nKey="plugins.install-readiness.title">Install readiness</Trans>
        </Text>
        <Icon name="shield" />
      </Stack>

      <Stack direction="column" gap={1}>
        <ReadinessRow
          label={t('plugins.install-readiness.grafana-version', 'Grafana compatibility')}
          testId="install-readiness-compatibility"
        >
          {isCompatible ? (
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="check-circle" color={theme.colors.success.text} />
              <Text>
                {grafanaDependency
                  ? t('plugins.install-readiness.compatible-with', 'Requires Grafana {{version}}', {
                      version: grafanaDependency,
                    })
                  : t('plugins.install-readiness.compatible', 'Compatible with this Grafana version')}
              </Text>
            </Stack>
          ) : (
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="exclamation-triangle" />
              <Text>
                <Trans i18nKey="plugins.install-readiness.incompatible">
                  No compatible version for this Grafana instance
                </Trans>
              </Text>
            </Stack>
          )}
        </ReadinessRow>

        <ReadinessRow
          label={t('plugins.install-readiness.signature', 'Signature')}
          testId="install-readiness-signature"
        >
          <Stack direction="row" gap={1} alignItems="center">
            <PluginSignatureBadge
              status={signatureStatus}
              signatureType={signatureType}
              signatureOrg={signatureOrg}
            />
            <Text color="secondary">
              {isSigned ? (
                <Trans i18nKey="plugins.install-readiness.signed">Signed</Trans>
              ) : (
                <Trans i18nKey="plugins.install-readiness.unsigned">Unsigned</Trans>
              )}
            </Text>
          </Stack>
        </ReadinessRow>

        {maintainerName && (
          <ReadinessRow label={t('plugins.install-readiness.maintainer', 'Maintainer')} testId="install-readiness-maintainer">
            {maintainerUrl ? (
              <TextLink href={maintainerUrl} external>
                {maintainerName}
              </TextLink>
            ) : (
              <Text>{maintainerName}</Text>
            )}
          </ReadinessRow>
        )}

        {(plugin.details?.changelog || readiness?.changelogPath) && (
          <ReadinessRow label={t('plugins.install-readiness.changelog', 'Changelog')} testId="install-readiness-changelog">
            <TextLink href={changelogPath}>
              <Trans i18nKey="plugins.install-readiness.view-changelog">View changelog</Trans>
            </TextLink>
          </ReadinessRow>
        )}
      </Stack>

      {readiness?.blockers?.map((blocker) => (
        <Alert key={blocker.id} severity="error" title={blocker.message} />
      ))}

      {readiness?.warnings?.map((warning) => (
        <Alert key={warning.id} severity="warning" title={warning.message} />
      ))}
    </Stack>
  );
}

function ReadinessRow({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="column" gap={0.25} data-testid={testId}>
      <Text color="secondary">{label}</Text>
      <Box>{children}</Box>
    </Stack>
  );
}
