import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { type InstallReadiness } from '../helpers';
import { type CatalogPlugin } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('InstallReadinessIndicator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a ready badge in the header actions area', () => {
    render(<InstallReadinessIndicator plugin={createPlugin()} readiness={createReadiness({ status: 'ready' })} />);

    expect(screen.getByTestId('plugin-install-readiness-indicator')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(reportInteraction).not.toHaveBeenCalled();
  });

  it('renders a blocked badge and tracks install deflection', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          status: 'blocked',
          reasons: ['incompatible'],
          latestCompatibleVersion: undefined,
          grafanaDependency: undefined,
        })}
      />
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_plugin_install_deflected',
      expect.objectContaining({
        plugin_id: 'test-plugin',
        readiness_status: 'blocked',
        blocker_reason: 'incompatible',
      })
    );
  });

  it('renders a warning badge for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ signature: PluginSignatureStatus.missing })}
        readiness={createReadiness({
          status: 'warning',
          reasons: ['unsigned'],
          signature: PluginSignatureStatus.missing,
        })}
      />
    );

    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_plugin_install_deflected',
      expect.objectContaining({
        readiness_status: 'warning',
        blocker_reason: 'unsigned',
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
    signatureType: PluginSignatureType.grafana,
    signatureOrg: 'grafana',
    info: { logos: { small: '', large: '' }, keywords: [] },
    downloads: 0,
    popularity: 0,
    orgName: 'Test Org',
    orgUrl: 'https://example.com',
    publishedAt: '',
    updatedAt: '',
    isPublished: true,
    isDev: false,
    isEnterprise: false,
    isDeprecated: false,
    isPreinstalled: { found: false, withVersion: false },
    ...overrides,
  };
}

function createReadiness(overrides?: Partial<InstallReadiness>): InstallReadiness {
  return {
    status: 'ready',
    reasons: [],
    latestCompatibleVersion: {
      version: '1.0.0',
      createdAt: '',
      isCompatible: true,
      grafanaDependency: '>=9.0.0',
    },
    grafanaDependency: '>=9.0.0',
    signature: PluginSignatureStatus.valid,
    orgName: 'Test Org',
    orgUrl: 'https://example.com',
    hasChangelog: true,
    ...overrides,
  };
}
