import { reportInteraction } from '@grafana/runtime';

import { resetPluginInstallDeflectionTracking, trackPluginInstallDeflected } from './tracking';

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');

  return {
    ...runtime,
    reportInteraction: jest.fn(),
  };
});

describe('trackPluginInstallDeflected', () => {
  afterEach(() => {
    jest.mocked(reportInteraction).mockClear();
    resetPluginInstallDeflectionTracking();
  });

  it('reports a deflection once for the same plugin and reason', () => {
    const props = {
      plugin_id: 'test-plugin',
      plugin_type: 'app',
      path: '/plugins/test-plugin',
      reason: 'missing_signature',
      status: 'warning',
    };

    trackPluginInstallDeflected(props);
    trackPluginInstallDeflected(props);

    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_plugin_install_deflected', props);
  });

  it('reports again when the blocker reason changes', () => {
    trackPluginInstallDeflected({
      plugin_id: 'test-plugin',
      path: '/plugins/test-plugin',
      reason: 'missing_signature',
      status: 'warning',
    });
    trackPluginInstallDeflected({
      plugin_id: 'test-plugin',
      path: '/plugins/test-plugin',
      reason: 'incompatible',
      status: 'blocked',
    });

    expect(reportInteraction).toHaveBeenCalledTimes(2);
  });
});
