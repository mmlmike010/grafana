import { render, screen } from 'test/test-utils';
import userEvent from '@testing-library/user-event';

import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';

import { type CatalogPlugin, type InstallReadiness, type Version } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

const compatibleVersion: Version = {
  version: '1.2.3',
  createdAt: '',
  isCompatible: true,
  grafanaDependency: '>=9.0.0',
};

describe('InstallReadinessIndicator', () => {
  it('renders a ready badge for compatible signed plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub()}
        readiness={createReadiness({
          status: 'ready',
          signature: { kind: 'valid', type: PluginSignatureType.community, org: 'grafana' },
          latestCompatibleVersion: compatibleVersion,
          grafanaDependency: '>=9.0.0',
        })}
      />
    );

    const indicator = screen.getByTestId('plugin-install-readiness');
    expect(indicator).toHaveAttribute('data-status', 'ready');
    expect(indicator).toHaveTextContent('Ready');
  });

  it('renders a warning badge for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub({ signature: PluginSignatureStatus.missing })}
        readiness={createReadiness({
          status: 'warning',
          warningReason: 'unsigned_signature',
          signature: { kind: 'unsigned' },
          latestCompatibleVersion: compatibleVersion,
        })}
      />
    );

    expect(screen.getByTestId('plugin-install-readiness')).toHaveAttribute('data-status', 'warning');
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders a blocked badge for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub()}
        readiness={createReadiness({
          status: 'blocked',
          reasons: ['no_compatible_version'],
          signature: { kind: 'valid' },
        })}
      />
    );

    expect(screen.getByTestId('plugin-install-readiness')).toHaveAttribute('data-status', 'blocked');
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('exposes changelog and maintainer links from the header popover', async () => {
    const user = userEvent.setup();
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub({
          details: {
            links: [],
            changelog: 'Release notes',
          },
        })}
        readiness={createReadiness({
          status: 'ready',
          signature: { kind: 'valid' },
          latestCompatibleVersion: compatibleVersion,
          grafanaDependency: '>=9.0.0',
          changelogAvailable: true,
          orgName: 'Grafana Labs',
          orgUrl: 'https://grafana.com',
          sourceUrl: 'https://github.com/grafana/ace-svg-panel',
        })}
      />
    );

    await user.click(screen.getByTestId('plugin-install-readiness'));

    expect(await screen.findByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/plugins/test-plugin?page=changelog'
    );
    expect(screen.getByRole('link', { name: 'Grafana Labs' })).toHaveAttribute('href', 'https://grafana.com');
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://github.com/grafana/ace-svg-panel'
    );
  });
});

function createReadiness(overrides: InstallReadiness): InstallReadiness {
  return {
    latestCompatibleVersion: undefined,
    grafanaDependency: undefined,
    changelogAvailable: false,
    orgName: 'Test Org',
    orgUrl: undefined,
    sourceUrl: undefined,
    signature: { kind: 'valid' },
    ...overrides,
  };
}

function createPluginStub(overrides?: Partial<CatalogPlugin>): CatalogPlugin {
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
