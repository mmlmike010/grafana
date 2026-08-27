import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus } from '@grafana/data';

import { getCatalogPluginMock } from '../mocks/mockHelpers';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

describe('InstallReadinessIndicator', () => {
  it('shows compatibility, signature, changelog, maintainer, and source details', async () => {
    const user = userEvent.setup();
    const plugin = getCatalogPluginMock({
      orgUrl: 'https://grafana.com/orgs/grafana',
      url: 'https://github.com/grafana/example-plugin',
      details: {
        links: [],
        changelog: '<h1>Changelog</h1>',
      },
    });

    render(
      <InstallReadinessIndicator
        plugin={plugin}
        readiness={{
          status: 'ready',
          version: '2.1.0',
          grafanaDependency: '>=11.0.0',
          signature: PluginSignatureStatus.valid,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Install readiness: Ready' }));

    expect(screen.getByText('Compatible version 2.1.0')).toBeInTheDocument();
    expect(screen.getByText('Requires Grafana >=11.0.0')).toBeInTheDocument();
    expect(screen.getByText('Signed and verified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', '?page=changelog');
    expect(screen.getByRole('link', { name: 'Maintainer' })).toHaveAttribute(
      'href',
      'https://grafana.com/orgs/grafana'
    );
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://github.com/grafana/example-plugin'
    );
  });

  it('makes blocked compatibility and an invalid signature obvious', async () => {
    const user = userEvent.setup();

    render(
      <InstallReadinessIndicator
        plugin={getCatalogPluginMock()}
        readiness={{
          status: 'blocked',
          reason: 'incompatible_grafana_version',
          grafanaDependency: '>=13.0.0',
          signature: PluginSignatureStatus.invalid,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Install readiness: Blocked' }));

    expect(screen.getByText('No compatible version')).toBeInTheDocument();
    expect(screen.getByText('Requires Grafana >=13.0.0')).toBeInTheDocument();
    expect(screen.getByText('Invalid signature')).toBeInTheDocument();
  });
});
