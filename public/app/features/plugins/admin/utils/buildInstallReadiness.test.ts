import { PluginSignatureStatus, PluginType } from '@grafana/data';

import { getCatalogPluginMock } from '../mocks/mockHelpers';

import { buildInstallReadiness } from './buildInstallReadiness';

describe('buildInstallReadiness', () => {
  it('marks compatible signed plugins as ready to install', () => {
    const plugin = getCatalogPluginMock({
      isInstalled: false,
      isPublished: true,
      signature: PluginSignatureStatus.valid,
      details: {
        versions: [{ version: '1.0.0', isCompatible: true, grafanaDependency: '>=11.0.0' }],
        grafanaDependency: '>=11.0.0',
        changelog: '# Changelog',
        links: [],
      },
    });

    const summary = buildInstallReadiness(plugin, true, {
      grafanaVersion: '12.0.0',
      allowUnsignedPlugins: false,
    });

    expect(summary.canInstall).toBe(true);
    expect(summary.blockers).toHaveLength(0);
    expect(summary.isCompatible).toBe(true);
    expect(summary.hasChangelog).toBe(true);
    expect(summary.grafanaVersion).toBe('12.0.0');
  });

  it('flags incompatible and unsigned plugins', () => {
    const plugin = getCatalogPluginMock({
      isInstalled: false,
      isPublished: true,
      signature: PluginSignatureStatus.missing,
      details: {
        versions: [{ version: '1.0.0', isCompatible: false, grafanaDependency: '>=99.0.0' }],
        grafanaDependency: '>=99.0.0',
        links: [],
      },
    });

    const summary = buildInstallReadiness(plugin, true, {
      grafanaVersion: '12.0.0',
      allowUnsignedPlugins: false,
    });

    expect(summary.canInstall).toBe(false);
    expect(summary.blockers).toEqual(expect.arrayContaining(['incompatible_version', 'unsigned_plugin']));
    expect(summary.isUnsigned).toBe(true);
  });

  it('includes renderer plugins as blocked', () => {
    const plugin = getCatalogPluginMock({
      type: PluginType.renderer,
      isPublished: true,
      details: {
        versions: [{ version: '1.0.0', isCompatible: true }],
        links: [],
      },
    });

    const summary = buildInstallReadiness(plugin, true, { grafanaVersion: '12.0.0', allowUnsignedPlugins: false });

    expect(summary.blockers).toContain('renderer_plugin');
  });
});
