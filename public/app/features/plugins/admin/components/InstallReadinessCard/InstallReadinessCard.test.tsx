import { PluginSignatureStatus } from '@grafana/data';
import { render, screen } from 'test/test-utils';

import catalogPluginMock from '../mocks/catalogPlugin.mock';
import { type CatalogPlugin } from '../types';

import { InstallReadinessCard } from './InstallReadinessCard';

jest.mock('../../state/hooks', () => ({
  useIsRemotePluginsAvailable: () => true,
}));

jest.mock('../../tracking', () => ({
  trackInstallReadinessViewed: jest.fn(),
  trackInstallDeflection: jest.fn(),
}));

describe('InstallReadinessCard', () => {
  it('shows compatibility and signature summary', () => {
    const plugin: CatalogPlugin = {
      ...catalogPluginMock,
      signature: PluginSignatureStatus.valid,
      details: {
        ...catalogPluginMock.details!,
        changelog: 'Changes',
        versions: [{ version: '1.0.0', isCompatible: true, grafanaDependency: '>=11.0.0' }],
      },
    };

    render(
      <InstallReadinessCard
        plugin={plugin}
        readiness={{
          pluginId: plugin.id,
          grafanaVersion: '12.0.0',
          system: 'linux-amd64',
          grafanaDependency: '>=11.0.0',
          isCompatible: true,
          isSigned: true,
          canInstall: true,
          blockers: [],
          warnings: [],
          changelogPath: `/plugins/${plugin.id}?page=changelog`,
          maintainerName: 'Grafana Labs',
        }}
      />
    );

    expect(screen.getByTestId('install-readiness-card')).toBeInTheDocument();
    expect(screen.getByTestId('install-readiness-compatibility')).toHaveTextContent('Requires Grafana >=11.0.0');
    expect(screen.getByTestId('install-readiness-signature')).toHaveTextContent('Signed');
    expect(screen.getByTestId('install-readiness-maintainer')).toHaveTextContent('Grafana Labs');
    expect(screen.getByTestId('install-readiness-changelog')).toHaveTextContent('View changelog');
  });
});
