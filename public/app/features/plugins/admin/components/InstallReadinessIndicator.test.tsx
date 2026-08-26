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
    expect(screen.getByRole('button', { name: 'View plugin readiness: Ready to install' })).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).not.toHaveBeenCalled();
  });

  it('opens compatibility details with changelog and maintainer links', async () => {
    const user = userEvent.setup();
    render(<InstallReadinessIndicator plugin={createPlugin()} readiness={createReadiness()} />);

    await user.click(screen.getByLabelText('View plugin readiness: Ready to install'));

    expect(screen.getByText('Compatible version: 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Grafana dependency: >=10.0.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Changelog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://github.com/example/plugin');
    expect(screen.getByRole('link', { name: 'Maintainer' })).toHaveAttribute('href', 'https://example.com');
  });

  it('does not use the maintainer site as the Source link', async () => {
    const user = userEvent.setup();
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          orgUrl: 'https://maintainer.example',
          repositoryUrl: 'https://github.com/example/plugin',
        })}
      />
    );

    await user.click(screen.getByLabelText('View plugin readiness: Ready to install'));

    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://github.com/example/plugin');
    expect(screen.getByRole('link', { name: 'Maintainer' })).toHaveAttribute('href', 'https://maintainer.example');
  });

  it('renders a warning badge and tracks deflection for unsigned plugins', () => {
    const plugin = createPlugin({ signature: PluginSignatureStatus.missing });
    const readiness = createReadiness({
      status: 'warning',
      reason: 'missing_signature',
      label: 'Unsigned',
      signature: PluginSignatureStatus.missing,
      shouldTrackDeflection: true,
    });
    const { rerender } = render(<InstallReadinessIndicator plugin={plugin} readiness={readiness} />);

    rerender(<InstallReadinessIndicator plugin={plugin} readiness={readiness} />);

    expect(screen.getByText('Unsigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View plugin readiness: Unsigned' })).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledTimes(1);
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        reason: 'missing_signature',
        status: 'warning',
      })
    );
  });

  it('tracks a new deflection when the blocker reason changes', () => {
    const plugin = createPlugin();
    const warningReadiness = createReadiness({
      status: 'warning',
      reason: 'missing_signature',
      label: 'Unsigned',
      shouldTrackDeflection: true,
    });
    const { rerender } = render(<InstallReadinessIndicator plugin={plugin} readiness={warningReadiness} />);

    rerender(
      <InstallReadinessIndicator
        plugin={plugin}
        readiness={createReadiness({
          status: 'blocked',
          reason: 'incompatible',
          label: 'Incompatible',
          shouldTrackDeflection: true,
        })}
      />
    );

    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledTimes(2);
    expect(tracking.trackPluginInstallDeflected).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        reason: 'incompatible',
        status: 'blocked',
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

  it('does not render or track while version details are still loading', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPlugin()}
        readiness={createReadiness({
          isPending: true,
          reason: 'compatibility_unknown',
          label: 'Checking compatibility',
          latestCompatibleVersion: undefined,
          grafanaDependency: undefined,
          shouldTrackDeflection: false,
        })}
      />
    );

    expect(screen.queryByTestId('plugin-install-readiness')).not.toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).not.toHaveBeenCalled();
  });

  it('tracks incompatible only after version details resolve as blocked', () => {
    const plugin = createPlugin();
    const { rerender } = render(
      <InstallReadinessIndicator
        plugin={plugin}
        readiness={createReadiness({
          isPending: true,
          reason: 'compatibility_unknown',
          label: 'Checking compatibility',
          latestCompatibleVersion: undefined,
          shouldTrackDeflection: false,
        })}
      />
    );

    rerender(
      <InstallReadinessIndicator
        plugin={plugin}
        readiness={createReadiness({
          status: 'blocked',
          reason: 'incompatible',
          label: 'Incompatible',
          latestCompatibleVersion: undefined,
          shouldTrackDeflection: true,
          isPending: false,
        })}
      />
    );

    expect(screen.getByText('Incompatible')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledTimes(1);
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
    isPending: false,
    ...overrides,
  };
}
