import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus } from '@grafana/data';

import { type InstallReadiness } from '../helpers';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';

const ready: InstallReadiness = {
  status: 'ready',
  compatibleVersion: '2.1.0',
  grafanaDependency: '>=10.0.0',
  signature: PluginSignatureStatus.valid,
  changelogAvailable: true,
  maintainerName: 'Example Org',
  maintainerUrl: 'https://example.com/org',
};

describe('InstallReadinessIndicator', () => {
  it('renders a ready badge next to install actions', () => {
    render(<InstallReadinessIndicator readiness={ready} />);

    expect(screen.getByTestId('plugin-install-readiness')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders a warning badge for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        readiness={{ ...ready, status: 'warning', blockerReason: 'unsigned', signature: PluginSignatureStatus.missing }}
      />
    );

    expect(screen.getByText('Unsigned')).toBeInTheDocument();
  });

  it('renders a blocked badge for incompatible plugins', () => {
    render(
      <InstallReadinessIndicator
        readiness={{ ...ready, status: 'blocked', blockerReason: 'incompatible', compatibleVersion: undefined }}
      />
    );

    expect(screen.getByText('Incompatible')).toBeInTheDocument();
  });

  it('renders a blocked badge for invalid signatures', () => {
    render(
      <InstallReadinessIndicator
        readiness={{
          ...ready,
          status: 'blocked',
          blockerReason: 'invalid-signature',
          signature: PluginSignatureStatus.invalid,
        }}
      />
    );

    expect(screen.getByText('Invalid signature')).toBeInTheDocument();
  });

  it('exposes changelog and maintainer links in the popover', async () => {
    const user = userEvent.setup();
    render(<InstallReadinessIndicator readiness={ready} />);

    await user.click(screen.getByTestId('plugin-install-readiness'));

    expect(await screen.findByText(/Compatible version: 2.1.0/)).toBeInTheDocument();
    expect(screen.getByText(/Grafana: >=10.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/Signature: Signed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      expect.stringContaining('page=changelog')
    );
    expect(screen.getByRole('link', { name: /Maintainer: Example Org/ })).toHaveAttribute(
      'href',
      'https://example.com/org'
    );
  });
});
