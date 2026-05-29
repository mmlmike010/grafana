import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import {
  getInstallControlWarningReason,
  getInstallReadiness,
  getInstallReadinessSignatureState,
  hasInstallControlWarning,
  InstallReadinessBlockerReason,
  mapRemoteToCatalog,
} from './helpers';
import remotePluginMock from './mocks/remotePlugin.mock';
import { type CatalogPlugin, type Version } from './types';

function createPluginStub(overrides?: Partial<CatalogPlugin>): CatalogPlugin {
  return {
    managed: { enabled: false, strategy: undefined },
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
    info: { logos: { small: '', large: '' }, keywords: [] },
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

describe('plugin install readiness helpers', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    config.pluginAdminExternalManageEnabled = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getInstallReadinessSignatureState', () => {
    it.each([
      [PluginSignatureStatus.valid, 'signed'],
      [PluginSignatureStatus.internal, 'internal'],
      [PluginSignatureStatus.invalid, 'invalid'],
      [PluginSignatureStatus.modified, 'invalid'],
      [PluginSignatureStatus.missing, 'unsigned'],
      [undefined, 'unsigned'],
    ])('maps %s to %s', (status, expected) => {
      expect(getInstallReadinessSignatureState(status as PluginSignatureStatus)).toBe(expected);
    });
  });

  describe('getInstallControlWarningReason', () => {
    it('returns undefined for a compatible, published, signed plugin', () => {
      const plugin = createPluginStub();
      expect(getInstallControlWarningReason(plugin, true, createVersion())).toBeUndefined();
    });

    it('flags renderer plugins', () => {
      const plugin = createPluginStub({ type: PluginType.renderer });
      expect(getInstallControlWarningReason(plugin, true, createVersion())).toBe(
        InstallReadinessBlockerReason.RendererUnsupported
      );
    });

    it('flags unlicensed enterprise plugins', () => {
      const plugin = createPluginStub({ isEnterprise: true });
      expect(getInstallControlWarningReason(plugin, true, createVersion())).toBe(
        InstallReadinessBlockerReason.EnterpriseUnlicensed
      );
    });

    it('flags missing install permission', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const plugin = createPluginStub();
      expect(getInstallControlWarningReason(plugin, true, createVersion())).toBe(
        InstallReadinessBlockerReason.NoPermission
      );
    });

    it('flags unpublished plugins', () => {
      const plugin = createPluginStub({ isPublished: false });
      expect(getInstallControlWarningReason(plugin, true, createVersion())).toBe(
        InstallReadinessBlockerReason.NotPublished
      );
    });

    it('flags incompatible plugins (no compatible version)', () => {
      const plugin = createPluginStub();
      expect(getInstallControlWarningReason(plugin, true, undefined)).toBe(
        InstallReadinessBlockerReason.IncompatibleVersion
      );
    });

    it('flags when remote plugins are unavailable', () => {
      const plugin = createPluginStub();
      expect(getInstallControlWarningReason(plugin, false, createVersion())).toBe(
        InstallReadinessBlockerReason.RemoteUnavailable
      );
    });

    it('keeps hasInstallControlWarning in sync with the reason', () => {
      const blocked = createPluginStub({ isPublished: false });
      const ok = createPluginStub();
      expect(hasInstallControlWarning(blocked, true, createVersion())).toBe(true);
      expect(hasInstallControlWarning(ok, true, createVersion())).toBe(false);
    });
  });

  describe('getInstallReadiness', () => {
    it('reports an installable, compatible, signed plugin', () => {
      const plugin = createPluginStub();
      const readiness = getInstallReadiness(plugin, true, createVersion({ version: '2.0.0' }));

      expect(readiness).toMatchObject({
        canInstall: true,
        blockerReason: undefined,
        isCompatible: true,
        latestCompatibleVersion: '2.0.0',
        grafanaDependency: '>=10.0.0',
        signatureState: 'signed',
      });
    });

    it('falls back to plugin details grafana dependency when version has none', () => {
      const plugin = createPluginStub({ details: { links: [], grafanaDependency: '>=9.5.0' } });
      const readiness = getInstallReadiness(plugin, true, createVersion({ grafanaDependency: null }));

      expect(readiness.grafanaDependency).toBe('>=9.5.0');
    });

    it('treats an invalid signature as a blocker', () => {
      const plugin = createPluginStub({ signature: PluginSignatureStatus.invalid });
      const readiness = getInstallReadiness(plugin, true, createVersion());

      expect(readiness.canInstall).toBe(false);
      expect(readiness.blockerReason).toBe(InstallReadinessBlockerReason.InvalidSignature);
      expect(readiness.signatureState).toBe('invalid');
    });

    it('prefers a control blocker over the signature blocker', () => {
      const plugin = createPluginStub({ isPublished: false, signature: PluginSignatureStatus.invalid });
      const readiness = getInstallReadiness(plugin, true, createVersion());

      expect(readiness.blockerReason).toBe(InstallReadinessBlockerReason.NotPublished);
    });

    it('reports incompatibility when no compatible version exists', () => {
      const plugin = createPluginStub();
      const readiness = getInstallReadiness(plugin, true, undefined);

      expect(readiness.canInstall).toBe(false);
      expect(readiness.isCompatible).toBe(false);
      expect(readiness.blockerReason).toBe(InstallReadinessBlockerReason.IncompatibleVersion);
    });
  });

  describe('mapRemoteToCatalog orgUrl mapping', () => {
    it('maps the remote orgUrl onto the catalog plugin', () => {
      const catalog = mapRemoteToCatalog(remotePluginMock);
      expect(catalog.orgUrl).toBe(remotePluginMock.orgUrl);
    });
  });
});
