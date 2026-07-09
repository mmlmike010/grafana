import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';

import * as tracking from '../tracking';
import { type CatalogPlugin, type Version } from '../types';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(() => ({ pathname: '/plugins/test-plugin' })),
  },
}));

describe('InstallReadinessIndicator', () => {
  beforeEach(() => {
    jest.spyOn(tracking, 'trackPluginInstallDeflected').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a ready indicator for compatible signed plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub()}
        latestCompatibleVersion={createVersion()}
        isRemotePluginsAvailable={true}
        hasInstallPermission={true}
      />
    );

    expect(screen.getByTestId('install-readiness-indicator')).toBeInTheDocument();
    expect(screen.getByText('Ready to install')).toBeInTheDocument();
  });

  it('renders a blocked indicator for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub()}
        latestCompatibleVersion={undefined}
        isRemotePluginsAvailable={true}
        hasInstallPermission={true}
      />
    );

    expect(screen.getByText('Incompatible version')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        plugin_id: 'test-plugin',
        blocker_reason: 'incompatible_version',
        readiness_state: 'blocked',
        path: '/plugins/test-plugin',
      })
    );
  });

  it('renders a warning indicator for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub({ signature: PluginSignatureStatus.missing })}
        latestCompatibleVersion={createVersion()}
        isRemotePluginsAvailable={true}
        hasInstallPermission={true}
      />
    );

    expect(screen.getByText('Unsigned plugin')).toBeInTheDocument();
    expect(tracking.trackPluginInstallDeflected).toHaveBeenCalledWith(
      expect.objectContaining({
        blocker_reason: 'unsigned_signature',
        readiness_state: 'warning',
      })
    );
  });

  it('does not render for core plugins', () => {
    render(
      <InstallReadinessIndicator
        plugin={createPluginStub({ isCore: true })}
        latestCompatibleVersion={createVersion()}
        isRemotePluginsAvailable={true}
        hasInstallPermission={true}
      />
    );

    expect(screen.queryByTestId('install-readiness-indicator')).not.toBeInTheDocument();
  });
});

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
    details: {
      grafanaDependency: '>=10.0.0',
      links: [],
      changelog: 'Changes',
    },
    orgUrl: 'https://github.com/test',
    url: 'https://github.com/test/plugin',
    ...overrides,
  };
}

function createVersion(overrides?: Partial<Version>): Version {
  return {
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    isCompatible: true,
    grafanaDependency: '>=10.0.0',
    angularDetected: false,
    ...overrides,
  };
}
