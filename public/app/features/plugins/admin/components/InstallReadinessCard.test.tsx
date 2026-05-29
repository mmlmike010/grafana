import { render, screen } from 'test/test-utils';

import { type InstallReadiness, InstallReadinessBlockerReason } from '../helpers';
import { type CatalogPlugin } from '../types';

import { InstallReadinessCard } from './InstallReadinessCard';

function createPlugin(overrides?: Partial<CatalogPlugin>): CatalogPlugin {
  return {
    managed: { enabled: false, strategy: undefined },
    name: 'Test Plugin',
    id: 'test-plugin',
    description: 'Test plugin',
    isCore: false,
    isInstalled: false,
    isDisabled: false,
    hasUpdate: false,
    signature: 'valid' as CatalogPlugin['signature'],
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
    ...overrides,
  };
}

function createReadiness(overrides?: Partial<InstallReadiness>): InstallReadiness {
  return {
    canInstall: true,
    blockerReason: undefined,
    isCompatible: true,
    latestCompatibleVersion: '2.0.0',
    grafanaDependency: '>=10.0.0',
    signatureState: 'signed',
    ...overrides,
  };
}

describe('InstallReadinessCard', () => {
  it('shows the compatible version and grafana dependency range', () => {
    render(<InstallReadinessCard plugin={createPlugin()} readiness={createReadiness()} pathname="/plugins/test-plugin" />);

    expect(screen.getByText(/Compatible version 2.0.0 available/i)).toBeInTheDocument();
    expect(screen.getByText(/Requires Grafana >=10.0.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Signed plugin/i)).toBeInTheDocument();
  });

  it('shows an incompatibility message when no compatible version exists', () => {
    render(
      <InstallReadinessCard
        plugin={createPlugin()}
        readiness={createReadiness({
          canInstall: false,
          isCompatible: false,
          latestCompatibleVersion: undefined,
          blockerReason: InstallReadinessBlockerReason.IncompatibleVersion,
        })}
        pathname="/plugins/test-plugin"
      />
    );

    expect(screen.getByText(/No version compatible with Grafana/i)).toBeInTheDocument();
    expect(screen.getByText(/No compatible version is available/i)).toBeInTheDocument();
  });

  it.each([
    ['unsigned', /Unsigned plugin/i],
    ['invalid', /Invalid plugin signature/i],
    ['internal', /Core \(internal\) plugin/i],
  ] as const)('renders the %s signature state', (signatureState, matcher) => {
    render(
      <InstallReadinessCard
        plugin={createPlugin()}
        readiness={createReadiness({ signatureState })}
        pathname="/plugins/test-plugin"
      />
    );

    expect(screen.getByText(matcher)).toBeInTheDocument();
  });

  it('links to the changelog and maintainer when available', () => {
    const plugin = createPlugin({
      orgUrl: 'https://example.com/org',
      details: { links: [], changelog: 'changes', repositoryUrl: 'https://github.com/test/plugin' },
    });

    render(<InstallReadinessCard plugin={plugin} readiness={createReadiness()} pathname="/plugins/test-plugin" />);

    expect(screen.getByRole('link', { name: /Changelog/i })).toHaveAttribute(
      'href',
      '/plugins/test-plugin?page=changelog'
    );
    expect(screen.getByRole('link', { name: /Maintainer/i })).toHaveAttribute('href', 'https://example.com/org');
    expect(screen.getByRole('link', { name: /Source/i })).toHaveAttribute('href', 'https://github.com/test/plugin');
  });

  it('does not render changelog link when there is no changelog', () => {
    render(<InstallReadinessCard plugin={createPlugin()} readiness={createReadiness()} pathname="/plugins/test-plugin" />);

    expect(screen.queryByRole('link', { name: /Changelog/i })).not.toBeInTheDocument();
  });
});
