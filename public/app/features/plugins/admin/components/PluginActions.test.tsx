import { render, screen } from 'test/test-utils';

import { PluginErrorCode, PluginSignatureStatus, PluginSignatureType } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import * as helpers from '../helpers';
import * as hooks from '../state/hooks';
import { initialState } from '../state/reducer';
import * as tracking from '../tracking';
import { type CatalogPlugin, PluginStatus, type ReducerState, type Version } from '../types';

import { getInstallControlsDisabled, getPluginStatus, PluginActions } from './PluginActions';

describe('PluginActions', () => {
  let plugins: ReducerState;

  beforeEach(() => {
    plugins = { ...initialState };
    jest.spyOn(helpers, 'isInstallControlsEnabled').mockReturnValue(true);
    jest.spyOn(helpers, 'hasInstallControlWarning').mockReturnValue(false);
    jest.spyOn(hooks, 'useIsRemotePluginsAvailable').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('render', () => {
    it('should render nothing when no plugin is provided', () => {
      render(<PluginActions />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render install button for non-installed plugin', () => {
      render(<PluginActions plugin={createPluginStub()} />, { preloadedState: { plugins } });

      expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument();
    });

    it('should render uninstall button for installed plugin', () => {
      const installedPlugin = createPluginStub({ isInstalled: true });
      render(<PluginActions plugin={installedPlugin} />, { preloadedState: { plugins } });

      expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
    });

    it('should render update button for plugin with update', () => {
      const pluginWithUpdate = createPluginStub({ isInstalled: true, hasUpdate: true });
      render(<PluginActions plugin={pluginWithUpdate} />, { preloadedState: { plugins } });

      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /uninstall/i })).toHaveAttribute('aria-disabled', 'false');
    });

    it('should not render install controls for core plugins', () => {
      const corePlugin = createPluginStub({ isCore: true });
      render(<PluginActions plugin={corePlugin} />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button', { name: /install|uninstall|update/i })).not.toBeInTheDocument();
    });

    it('should not render install controls for disabled plugins', () => {
      const disabledPlugin = createPluginStub({ isDisabled: true });
      render(<PluginActions plugin={disabledPlugin} />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button', { name: /install|uninstall|update/i })).not.toBeInTheDocument();
    });

    it('should not render install controls for provisioned plugins', () => {
      const provisionedPlugin = createPluginStub({ isProvisioned: true });
      render(<PluginActions plugin={provisionedPlugin} />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button', { name: /install|uninstall|update/i })).not.toBeInTheDocument();
    });

    it('should not render install controls when install controls are disabled', () => {
      jest.spyOn(helpers, 'isInstallControlsEnabled').mockReturnValue(false);
      render(<PluginActions plugin={createPluginStub()} />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button', { name: /install|uninstall|update/i })).not.toBeInTheDocument();
    });

    it('should render install controls when there is an installed disabled angular plugin with a non-angular version available', async () => {
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(createVersion({ angularDetected: false }));
      const disabledAngularPlugin = createPluginStub({
        isInstalled: true,
        isDisabled: true,
        error: PluginErrorCode.angular,
      });
      render(<PluginActions plugin={disabledAngularPlugin} />, { preloadedState: { plugins } });

      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /uninstall/i })).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not render install controls when there is an installed disabled angular plugin with no non-angular version available', () => {
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(createVersion({ angularDetected: true }));
      const disabledAngularPlugin = createPluginStub({
        isInstalled: true,
        isDisabled: true,
        error: PluginErrorCode.angular,
      });
      render(<PluginActions plugin={disabledAngularPlugin} />, { preloadedState: { plugins } });

      expect(screen.queryByRole('button', { name: /install|uninstall|update/i })).not.toBeInTheDocument();
    });
  });

  describe('install readiness', () => {
    it('renders the install readiness card for a non-installed plugin', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(createVersion({ grafanaDependency: '>=9.0.0' }));

      render(<PluginActions plugin={createPluginStub()} />, { preloadedState: { plugins } });

      expect(screen.getByTestId('plugin-install-readiness')).toBeInTheDocument();
    });

    it('does not render the readiness card for an installed plugin', () => {
      render(<PluginActions plugin={createPluginStub({ isInstalled: true })} />, { preloadedState: { plugins } });

      expect(screen.queryByTestId('plugin-install-readiness')).not.toBeInTheDocument();
    });

    it('tracks a deflection when a non-installed plugin cannot be installed', () => {
      const trackSpy = jest.spyOn(tracking, 'trackPluginInstallDeflected');
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      // No compatible version available => incompatible blocker.
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(undefined);

      render(<PluginActions plugin={createPluginStub()} />, { preloadedState: { plugins } });

      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin_id: 'test-plugin',
          blocker_reason: helpers.InstallReadinessBlockerReason.IncompatibleVersion,
        })
      );
    });

    it('does not track a deflection when the plugin can be installed', () => {
      const trackSpy = jest.spyOn(tracking, 'trackPluginInstallDeflected');
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(createVersion());

      render(<PluginActions plugin={createPluginStub()} />, { preloadedState: { plugins } });

      expect(trackSpy).not.toHaveBeenCalled();
    });

    it('does not track a deflection for an installed plugin', () => {
      const trackSpy = jest.spyOn(tracking, 'trackPluginInstallDeflected');
      jest.spyOn(helpers, 'getLatestCompatibleVersion').mockReturnValue(undefined);

      render(<PluginActions plugin={createPluginStub({ isInstalled: true })} />, { preloadedState: { plugins } });

      expect(trackSpy).not.toHaveBeenCalled();
    });
  });

  describe('getPluginStatus', () => {
    describe('regular plugins', () => {
      it('should return INSTALL for non-installed plugins', () => {
        const plugin = createPluginStub({ isInstalled: false });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.INSTALL);
      });

      it('should return UPDATE for installed plugins with updates', () => {
        const plugin = createPluginStub({ isInstalled: true, hasUpdate: true });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.UPDATE);
      });

      it('should return UNINSTALL for installed plugins without updates', () => {
        const plugin = createPluginStub({ isInstalled: true, hasUpdate: false });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.UNINSTALL);
      });
    });

    describe('angular plugins', () => {
      it('should return INSTALL for non-installed angular plugins', () => {
        const plugin = createPluginStub({
          isInstalled: false,
          error: PluginErrorCode.angular,
        });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.INSTALL);
      });

      it('should return UPDATE for installed angular plugins with non-angular version available', () => {
        const plugin = createPluginStub({
          isInstalled: true,
          error: PluginErrorCode.angular,
        });
        const latestVersion = createVersion({ angularDetected: false });

        expect(getPluginStatus(plugin, latestVersion)).toBe(PluginStatus.UPDATE);
      });

      it('should return UNINSTALL for installed angular plugins with only angular versions available', () => {
        const plugin = createPluginStub({
          isInstalled: true,
          error: PluginErrorCode.angular,
        });
        const latestVersion = createVersion({ angularDetected: true });

        expect(getPluginStatus(plugin, latestVersion)).toBe(PluginStatus.UNINSTALL);
      });

      it('should return UNINSTALL for installed angular plugins with no version info', () => {
        const plugin = createPluginStub({
          isInstalled: true,
          error: PluginErrorCode.angular,
        });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.UNINSTALL);
      });
    });

    describe('disabled plugins', () => {
      it('should handle disabled angular plugins', () => {
        const plugin = createPluginStub({
          isInstalled: true,
          isDisabled: true,
          error: PluginErrorCode.angular,
        });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.UNINSTALL);
      });

      it('should handle disabled regular plugins', () => {
        const plugin = createPluginStub({
          isInstalled: true,
          isDisabled: true,
        });

        expect(getPluginStatus(plugin, undefined)).toBe(PluginStatus.UNINSTALL);
      });
    });
  });

  describe('getInstallControlsDisabled', () => {
    it('should return false for disabled angular plugins that have a non-angular version available', () => {
      const plugin = createPluginStub({ isDisabled: true, error: PluginErrorCode.angular });
      const latestVersion = createVersion({ angularDetected: false });

      expect(getInstallControlsDisabled(plugin, latestVersion)).toBe(false);
    });

    it('should return true for disabled regular plugins', () => {
      const plugin = createPluginStub({ isDisabled: true });

      expect(getInstallControlsDisabled(plugin, undefined)).toBe(true);
    });

    it('should return true for core plugins', () => {
      const plugin = createPluginStub({ isCore: true });

      expect(getInstallControlsDisabled(plugin, undefined)).toBe(true);
    });

    it('should return true for provisioned plugins', () => {
      const plugin = createPluginStub({ isProvisioned: true });

      expect(getInstallControlsDisabled(plugin, undefined)).toBe(true);
    });

    it('should return false for regular plugins', () => {
      const plugin = createPluginStub({});

      expect(getInstallControlsDisabled(plugin, undefined)).toBe(false);
    });

    it('should return true when install controls are not enabled', () => {
      jest.spyOn(helpers, 'isInstallControlsEnabled').mockReturnValue(false);
      const plugin = createPluginStub({});

      expect(getInstallControlsDisabled(plugin, undefined)).toBe(true);
    });
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
    ...overrides,
  };
}

function createVersion(overrides?: Partial<Version>): Version {
  return {
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
    isCompatible: true,
    grafanaDependency: '',
    angularDetected: false,
    ...overrides,
  };
}
