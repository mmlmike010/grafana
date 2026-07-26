import { useEffect, useState } from 'react';

import { isFetchError } from '@grafana/runtime';

import { getPluginInstallReadiness } from '../../api';
import { type CatalogPlugin, type PluginInstallReadiness } from '../../types';

import { InstallReadinessCard } from './InstallReadinessCard';

type Props = {
  plugin: CatalogPlugin;
};

export function InstallReadinessCardContainer({ plugin }: Props) {
  const [readiness, setReadiness] = useState<PluginInstallReadiness | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async () => {
      setIsLoading(true);
      try {
        const response = await getPluginInstallReadiness(plugin.id, plugin.latestVersion);
        if (!cancelled) {
          setReadiness(response);
        }
      } catch (error) {
        if (!cancelled && isFetchError(error)) {
          error.isHandled = true;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [plugin.id, plugin.latestVersion]);

  return <InstallReadinessCard plugin={plugin} readiness={readiness} isLoading={isLoading} />;
}
