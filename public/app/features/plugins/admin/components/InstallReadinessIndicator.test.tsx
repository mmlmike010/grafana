import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginType } from '@grafana/data';

import { type InstallReadiness } from '../helpers';
import * as tracking from '../tracking';
import { type CatalogPlugin } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

jest.mock('../tracking', () => ({
  trackPluginInstallDeflected: jest.fn(),
}));

describe('InstallReadinessIndicator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a ready badge next to install controls', () => {
    render(<InstallReadinessIndicator plugin={createPlugin()} readiness={createReadiness()} />);

    expect(screen.getByTestId('plugin-install-readiness')).toBeInTheDocument();
    expect(screen.getByText('Ready to install')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).not.toHaveBeenCalled();
  });

  it('opens compatibility details with changelog and maintainer links', async () => {
    const user = userEvent.setup();
    render(<InstallReadinessIndicator plugin={createPlugin()} readiness={createReadiness()} />);

    await user.click(screen.getByLabelText('Install readiness: Ready to install'));

    expect(screen.getByText('Compatible version: 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Grafana dependency: >=10.0.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Changelog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://example.com');
  });

  it('renders a warning badge and tracks deflection for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ signature: PluginSignatureStatus.missing })}
        readiness={createReadiness({
          status: 'warning',
          reason: 'missing_signature',
          label: 'Unsigned',
          signature: PluginSignatureStatus.missing,
          shouldTrackDeflection: true,
        })}
      />
    );

    expect(screen.getByText('Unsigned')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        reason: 'missing_signature',
        status: 'warning',
      })
    );
  });

  it('renders a blocked badge and tracks deflection for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          status: 'blocked',
          reason: 'incompatible',
          label: 'Incompatible',
          shouldTrackDeflection: true,
        })}
      />
    );

    expect(screen.getByText('Incompatible')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'incompatible',
        status: 'blocked',
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
    type: PluginType.app,
    ...overrides,
  };
}

function createReadiness(overrides?: Partial<InstallReadiness>): InstallReadiness {
  return {
    status: 'ready',
    reason: 'ready',
    label: 'Ready to install',
    signature: PluginSignatureStatus.valid,
    latestCompatibleVersion: {
      version: '1.0.0',
      createdAt: '',
      isCompatible: true,
      grafanaDependency: '>=10.0.0',
    },
    grafanaDependency: '>=10.0.0',
    orgName: 'Test Org',
    orgUrl: 'https://example.com',
    repositoryUrl: 'https://github.com/example/plugin',
    hasChangelog: true,
    shouldTrackDeflection: false,
    ...overrides,
  };
}
