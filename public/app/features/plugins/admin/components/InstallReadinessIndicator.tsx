import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Badge,
  Popover,
  PopoverController,
  Stack,
  Text,
  TextLink,
  useStyles2,
  type IconName,
} from '@grafana/ui';

import {
  getInstallReadiness,
  InstallReadinessBlockerReason,
  InstallReadinessState,
  type InstallReadiness,
} from '../helpers';
import { trackPluginInstallDeflected } from '../tracking';
import { type CatalogPlugin, PluginTabIds, type Version } from '../types';

interface Props {
  plugin: CatalogPlugin;
  latestCompatibleVersion?: Version;
  isRemotePluginsAvailable: boolean;
  hasInstallPermission: boolean;
}

export function InstallReadinessIndicator({
  plugin,
  latestCompatibleVersion,
  isRemotePluginsAvailable,
  hasInstallPermission,
}: Props) {
  const styles = useStyles2(getStyles);
  const hasTrackedDeflection = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const readiness = getInstallReadiness(plugin, {
    latestCompatibleVersion,
    isRemotePluginsAvailable,
    hasInstallPermission,
  });

  useEffect(() => {
    if (!readiness || hasTrackedDeflection.current) {
      return;
    }

    if (readiness.state === InstallReadinessState.Warning || readiness.state === InstallReadinessState.Blocked) {
      hasTrackedDeflection.current = true;
      trackPluginInstallDeflected({
        plugin_id: plugin.id,
        plugin_type: plugin.type,
        path: locationService.getLocation().pathname,
        blocker_reason: readiness.blockerReason ?? 'unknown',
        readiness_state: readiness.state,
      });
    }
  }, [plugin.id, plugin.type, readiness]);

  if (!readiness) {
    return null;
  }

  const { icon, color, label } = getIndicatorPresentation(readiness);

  const popoverContent = (
    <Stack direction="column" gap={1} className={styles.popover}>
      <Text weight="medium">{getReadinessTitle(readiness)}</Text>
      {readiness.compatibleVersion && (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="plugins.install-readiness.compatible-version" values={{ version: readiness.compatibleVersion }}>
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
            Requires Grafana {'{{dependency}}'}
          </Trans>
        </Text>
      )}
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="plugins.install-readiness.signature" values={{ signature: readiness.signatureLabel }}>
          Signature: {'{{signature}}'}
        </Trans>
      </Text>
      <Stack direction="row" gap={1} wrap="wrap">
        {plugin.details?.changelog && (
          <TextLink href={`${locationService.getLocation().pathname}?page=${PluginTabIds.CHANGELOG}`}>
            <Trans i18nKey="plugins.install-readiness.changelog">Changelog</Trans>
          </TextLink>
        )}
        {plugin.orgUrl && (
          <TextLink href={plugin.orgUrl} external>
            <Trans i18nKey="plugins.install-readiness.maintainer">Maintainer</Trans>
          </TextLink>
        )}
        {plugin.url && (
          <TextLink href={plugin.url} external>
            <Trans i18nKey="plugins.install-readiness.source">Source</Trans>
          </TextLink>
        )}
      </Stack>
    </Stack>
  );

  return (
    <PopoverController content={popoverContent}>
      {(showPopper, hidePopper, popperProps) => (
        <>
          {triggerRef.current && popperProps.show && (
            <Popover
              {...popperProps}
              content={popoverContent}
              referenceElement={triggerRef.current}
              renderArrow
              placement="bottom-end"
              hidePopper={hidePopper}
            />
          )}
          <button
            ref={triggerRef}
            type="button"
            className={styles.trigger}
            data-testid="install-readiness-indicator"
            aria-label={label}
            onClick={popperProps.show ? hidePopper : showPopper}
            onMouseEnter={showPopper}
            onMouseLeave={hidePopper}
          >
            <Badge color={color} icon={icon} text={label} />
          </button>
        </>
      )}
    </PopoverController>
  );
}

function getIndicatorPresentation(readiness: InstallReadiness): {
  icon: IconName;
  color: 'green' | 'orange' | 'red';
  label: string;
} {
  switch (readiness.state) {
    case InstallReadinessState.Ready:
      return {
        icon: 'check-circle',
        color: 'green',
        label: t('plugins.install-readiness.label-ready', 'Ready to install'),
      };
    case InstallReadinessState.Warning:
      return {
        icon: 'exclamation-triangle',
        color: 'orange',
        label: getWarningLabel(readiness.blockerReason),
      };
    case InstallReadinessState.Blocked:
      return {
        icon: 'times-circle',
        color: 'red',
        label: getBlockedLabel(readiness.blockerReason),
      };
    default:
      return {
        icon: 'info-circle',
        color: 'orange',
        label: t('plugins.install-readiness.label-review', 'Review before install'),
      };
  }
}

function getWarningLabel(reason?: InstallReadinessBlockerReason): string {
  switch (reason) {
    case InstallReadinessBlockerReason.UnsignedSignature:
      return t('plugins.install-readiness.label-unsigned', 'Unsigned plugin');
    case InstallReadinessBlockerReason.DevPlugin:
      return t('plugins.install-readiness.label-dev', 'Development build');
    default:
      return t('plugins.install-readiness.label-warning', 'Install warning');
  }
}

function getBlockedLabel(reason?: InstallReadinessBlockerReason): string {
  switch (reason) {
    case InstallReadinessBlockerReason.IncompatibleVersion:
      return t('plugins.install-readiness.label-incompatible', 'Incompatible version');
    case InstallReadinessBlockerReason.InvalidSignature:
      return t('plugins.install-readiness.label-invalid-signature', 'Invalid signature');
    case InstallReadinessBlockerReason.ModifiedSignature:
      return t('plugins.install-readiness.label-modified-signature', 'Modified signature');
    case InstallReadinessBlockerReason.MissingPermission:
      return t('plugins.install-readiness.label-no-permission', 'Install not permitted');
    case InstallReadinessBlockerReason.EnterpriseUnlicensed:
      return t('plugins.install-readiness.label-enterprise', 'Enterprise only');
    case InstallReadinessBlockerReason.RemoteUnavailable:
      return t('plugins.install-readiness.label-remote-unavailable', 'Catalog unavailable');
    case InstallReadinessBlockerReason.NotPublished:
      return t('plugins.install-readiness.label-not-published', 'Not in catalog');
    case InstallReadinessBlockerReason.RendererPlugin:
      return t('plugins.install-readiness.label-renderer', 'Renderer plugin');
    default:
      return t('plugins.install-readiness.label-blocked', 'Install blocked');
  }
}

function getReadinessTitle(readiness: InstallReadiness): string {
  switch (readiness.state) {
    case InstallReadinessState.Ready:
      return t('plugins.install-readiness.title-ready', 'Install readiness: ready');
    case InstallReadinessState.Warning:
      return t('plugins.install-readiness.title-warning', 'Install readiness: review recommended');
    case InstallReadinessState.Blocked:
      return t('plugins.install-readiness.title-blocked', 'Install readiness: blocked');
    default:
      return t('plugins.install-readiness.title-default', 'Install readiness');
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  }),
  popover: css({
    maxWidth: theme.spacing(40),
    padding: theme.spacing(1),
  }),
});
