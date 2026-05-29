import { useEffect, useState } from 'react';

import { config } from '@grafana/runtime';

import { getPluginInstallReadinessContext } from '../api';
import { type PluginInstallReadinessContext } from '../utils/buildInstallReadiness';

export function usePluginInstallReadinessContext(pluginId: string) {
  const [context, setContext] = useState<PluginInstallReadinessContext | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    if (!config.featureToggles.pluginInstallReadiness) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    getPluginInstallReadinessContext(pluginId)
      .then((result) => {
        if (!cancelled) {
          setContext(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  return { context, isLoading, error };
}
