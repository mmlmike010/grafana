import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus } from '@grafana/data';

import { InstallReadinessIndicator } from './InstallReadinessIndicator';
import { InstallReadinessSeverity, type InstallReadinessResult } from '../../types';

describe('InstallReadinessIndicator', () => {
  it('renders a ready badge with compatibility details', () => {
    render(
      <InstallReadinessIndicator
        pluginName="Test Plugin"
        readiness={createReadiness({
          severity: InstallReadinessSeverity.Ready,
          reason: 'ready',
          label: 'Ready',
          latestCompatibleVersion: {
            version: '1.2.0',
            createdAt: '',
            isCompatible: true,
            grafanaDependency: '>=10.0.0',
          },
          grafanaDependency: '>=10.0.0',
        })}
      />
    );

    expect(screen.getByTestId('plugin-install-readiness-indicator')).toHaveTextContent('Ready');
  });

  it('renders a warning badge for unsigned plugins', () => {
    render(
      <InstallReadinessIndicator
        pluginName="Test Plugin"
        readiness={createReadiness({
          severity: InstallReadinessSeverity.Warning,
          reason: 'unsigned',
          label: 'Unsigned',
          signatureStatus: PluginSignatureStatus.missing,
        })}
      />
    );

    expect(screen.getByTestId('plugin-install-readiness-indicator')).toHaveTextContent('Unsigned');
  });
});

function createReadiness(overrides: Partial<InstallReadinessResult>): InstallReadinessResult {
  return {
    severity: InstallReadinessSeverity.Ready,
    reason: 'ready',
    label: 'Ready',
    signatureStatus: PluginSignatureStatus.valid,
    hasInstallWarning: false,
    ...overrides,
  };
}
