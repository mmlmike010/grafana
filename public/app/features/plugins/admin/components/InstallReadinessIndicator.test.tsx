import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';

import * as tracking from '../tracking';
import { type CatalogPlugin, type Version } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

describe('InstallReadinessIndicator', () => {
  const compatibleVersion: Version = {
    version: '1.2.3',
    createdAt: '2024-01-01T00:00:00.000Z',
    isCompatible: true,
    grafanaDependency: '>=9.0.0',
  };

  beforeEach(() => {
    jest.spyOn(tracking, 'trackPluginInstallDeflected').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a ready badge next to installable signed plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ signature: PluginSignatureStatus.valid })}
        latestCompatibleVersion={compatibleVersion}
        isRemotePluginsAvailable
      />
    );

    const indicator = screen.getByTestId('install-readiness-indicator');
    expect(indicator).toHaveAttribute('data-readiness-status', 'ready');
    expect(indicator).toHaveAccessibleName(/ready/i);
    expect(tracking.trackPluginInstallDeflected).not.toHaveBeenCalled();
  });

  it('renders a warning badge and tracks deflection for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ signature: PluginSignatureStatus.missing, isInstalled: false })}
        latestCompatibleVersion={compatibleVersion}
        isRemotePluginsAvailable
      />
    );

    expect(screen.getByTestId('install-readiness-indicator')).toHaveAttribute('data-readiness-status', 'warning');
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        blocker_reason: 'unsigned',
        readiness_status: 'warning',
      })
    );
  });

  it('renders a blocked badge and tracks deflection for invalid signatures', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ signature: PluginSignatureStatus.invalid, isInstalled: false })}
        latestCompatibleVersion={compatibleVersion}
        isRemotePluginsAvailable
      />
    );

    expect(screen.getByTestId('install-readiness-indicator')).toHaveAttribute('data-readiness-status', 'blocked');
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        blocker_reason: 'invalid_signature',
        readiness_status: 'blocked',
      })
    );
  });

  it('renders a blocked badge and tracks deflection for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ isInstalled: false })}
        latestCompatibleVersion={undefined}
        isRemotePluginsAvailable
      />
    );

    expect(screen.getByTestId('install-readiness-indicator')).toHaveAttribute('data-readiness-status', 'blocked');
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        blocker_reason: 'incompatible',
        readiness_status: 'blocked',
      })
    );
  });

  it('does not track deflection for already installed plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin({ isInstalled: true, signature: PluginSignatureStatus.missing })}
        latestCompatibleVersion={compatibleVersion}
        isRemotePluginsAvailable
      />
    );

    expect(tracking.trackPluginInstallDeflected).not.toHaveBeenCalled();
  });

  it('exposes changelog and maintainer links from the header popover', async () => {
    const user = userEvent.setup();

    render(
      <InstallReadinessIndicator
        plugin={createPlugin({
          orgUrl: 'https://example.com/maintainer',
          orgName: 'Example Org',
          details: {
            links: [],
            changelog: '## 1.2.3',
            grafanaDependency: '>=9.0.0',
          },
        })}
        latestCompatibleVersion={compatibleVersion}
        isRemotePluginsAvailable
      />
    );

    await user.click(screen.getByTestId('install-readiness-indicator'));

    expect(await screen.findByRole('link', { name: /changelog/i })).toHaveAttribute(
      'href',
      '/plugins/test-plugin?page=changelog'
    );
    expect(screen.getByRole('link', { name: /example org/i })).toHaveAttribute(
      'href',
      'https://example.com/maintainer'
    );
    expect(screen.getByText(/compatible version: 1.2.3/i)).toBeInTheDocument();
    expect(screen.getByText(/signed/i)).toBeInTheDocument();
  });
});

function createPlugin(overrides?: Partial<CatalogPlugin>): CatalogPlugin {
  return {
    managed: {
      enabled: false,
      strategy: undefined,
    },
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
    info: {
      logos: { small: '', large: '' },
      keywords: [],
    },
    error: undefined,
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
    ...overrides,
  };
}
