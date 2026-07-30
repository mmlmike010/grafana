import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus } from '@grafana/data';
import * as runtime from '@grafana/runtime';

import { InstallReadinessStatus, type CatalogPlugin, type InstallReadiness } from '../../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: () => ({ pathname: '/plugins/test-plugin' }),
}));

describe('InstallReadinessIndicator', () => {
  beforeEach(() => {
    jest.spyOn(runtime, 'reportInteraction').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders ready badge and compatibility details', async () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness()}
        pluginStatus="INSTALL"
      />
    );

    expect(screen.getByTestId('install-readiness-indicator')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders blocked badge for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          status: InstallReadinessStatus.Blocked,
          reason: 'incompatible',
          isDeflected: true,
        })}
        pluginStatus="INSTALL"
      />
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('tracks install deflection once for blocked readiness', () => {
    const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');

    const { rerender } = render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          status: InstallReadinessStatus.Blocked,
          reason: 'incompatible',
          isDeflected: true,
        })}
        pluginStatus="INSTALL"
      />
    );

    rerender(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          status: InstallReadinessStatus.Blocked,
          reason: 'incompatible',
          isDeflected: true,
        })}
        pluginStatus="INSTALL"
      />
    );

    expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
    expect(reportInteractionSpy).toHaveBeenCalledWith(
      'grafana_plugin_install_deflected',
      expect.objectContaining({
        plugin_id: 'test-plugin',
        readiness_reason: 'incompatible',
      })
    );
  });
});

function createPlugin(overrides?: Partial<CatalogPlugin>): CatalogPlugin {
  return {
    managed: { enabled: false },
    name: 'Test Plugin',
    id: 'test-plugin',
    description: 'Test plugin',
    isCore: false,
    isInstalled: false,
    isDisabled: false,
    isProvisioned: false,
    hasUpdate: false,
    signature: PluginSignatureStatus.valid,
    info: { logos: { small: '', large: '' }, keywords: [] },
    downloads: 0,
    popularity: 0,
    orgName: 'Test Org',
    publishedAt: '',
    updatedAt: '',
    isPublished: true,
    isDev: false,
    isEnterprise: false,
    isDeprecated: false,
    isPreinstalled: { found: false, withVersion: false },
    url: 'https://grafana.com/plugins/test-plugin',
    ...overrides,
  };
}

function createReadiness(overrides?: Partial<InstallReadiness>): InstallReadiness {
  return {
    status: InstallReadinessStatus.Ready,
    reason: 'ready',
    signature: PluginSignatureStatus.valid,
    links: {
      hasChangelog: true,
      repositoryUrl: 'https://github.com/grafana/test-plugin',
      maintainerUrl: 'https://github.com/grafana/test-plugin',
    },
    isDeflected: false,
    latestCompatibleVersion: {
      version: '2.0.0',
      createdAt: '',
      updatedAt: '',
      isCompatible: true,
      grafanaDependency: '>=10.0.0',
      angularDetected: false,
    },
    grafanaDependency: '>=10.0.0',
    ...overrides,
  };
}
