import { of } from 'rxjs';

import { getBackendSrv, type MonitoringLogger, setBackendSrv } from '@grafana/runtime';
import { installPluginMeta, setPluginMetaLogger, uninstallPluginMeta } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { configureStore } from 'app/store/configureStore';

import { installPlugin, uninstallPlugin } from './api';

jest.mock('@grafana/runtime/internal', () => {
  const actual = jest.requireActual('@grafana/runtime/internal');
  return {
    ...actual,
    installPluginMeta: jest.fn(actual.installPluginMeta),
    uninstallPluginMeta: jest.fn(actual.uninstallPluginMeta),
  };
});

const installPluginMetaMock = jest.mocked(installPluginMeta);
const uninstallPluginMetaMock = jest.mocked(uninstallPluginMeta);
const originalFetch = global.fetch;

describe('api', () => {
  let logger: MonitoringLogger;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    configureStore();
    fetchMock = jest.fn().mockImplementation((opts: { url?: string; method?: string }) => {
      if (opts.method === 'POST' && opts.url?.includes('/install')) {
        return of({ data: {}, ok: true, status: 200 });
      }
      if (opts.method === 'POST' && opts.url?.includes('/uninstall')) {
        return of({ data: {}, ok: true, status: 200 });
      }
      return of({ data: {}, ok: true, status: 200 });
    });
    setBackendSrv({
      chunked: jest.fn(),
      delete: jest.fn(),
      fetch: fetchMock,
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      request: jest.fn(),
      datasourceRequest: jest.fn(),
    });
    logger = {
      logDebug: jest.fn(),
      logError: jest.fn(),
      logInfo: jest.fn(),
      logMeasurement: jest.fn(),
      logWarning: jest.fn(),
    };
    setPluginMetaLogger(logger);
    jest.spyOn(console, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('when useMTPlugins flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ useMTPlugins: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    describe('installPlugin', () => {
      it('should call both legacy api and new api', async () => {
        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins', {
          body: JSON.stringify({
            apiVersion: 'plugins.grafana.app/v0alpha1',
            kind: 'Plugin',
            metadata: {
              name: 'myorg-test-panel',
              namespace: 'default',
            },
            spec: {
              id: 'myorg-test-panel',
              version: '1.5.0',
            },
            status: {},
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/install',
            method: 'POST',
            data: { version: '1.5.0' },
            showErrorAlert: false,
          })
        );
      });

      it('should call legacy api when installPluginMeta fails but log failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/install',
            method: 'POST',
            data: { version: '1.5.0' },
            showErrorAlert: false,
          })
        );
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          'PluginMeta: Failed to install plugin with id myorg-test-panel and version 1.5.0',
          new Error('Network Error')
        );
        expect(logger.logError).toHaveBeenCalledTimes(1);
        expect(logger.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'PluginMeta: Failed to install plugin with id myorg-test-panel and version 1.5.0',
            cause: expect.objectContaining({
              message: 'Network Error',
            }),
          })
        );
      });
    });

    describe('uninstallPlugin', () => {
      it('should call both legacy api and new api', async () => {
        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          'apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/myorg-test-panel',
          { method: 'DELETE' }
        );
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/uninstall',
            method: 'POST',
          })
        );
      });

      it('should call legacy api when uninstallPluginMeta fails but log failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/uninstall',
            method: 'POST',
          })
        );
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          'PluginMeta: Failed to uninstall plugin with id myorg-test-panel',
          new Error('Network Error')
        );
        expect(logger.logError).toHaveBeenCalledTimes(1);
        expect(logger.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'PluginMeta: Failed to uninstall plugin with id myorg-test-panel',
            cause: expect.objectContaining({
              message: 'Network Error',
            }),
          })
        );
      });
    });
  });

  describe('when useMTPlugins flag is disabled', () => {
    beforeAll(() => {
      setTestFlags({ useMTPlugins: false });
    });

    afterAll(() => {
      setTestFlags({});
    });

    describe('installPlugin', () => {
      it('should only call legacy api', async () => {
        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
        expect(global.fetch).not.toHaveBeenCalled(); // no call to fetch is made because of feature flag check in installPluginMeta
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/install',
            method: 'POST',
            data: { version: '1.5.0' },
            showErrorAlert: false,
          })
        );
      });
    });

    describe('uninstallPlugin', () => {
      it('should only call legacy api', async () => {
        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
        expect(global.fetch).not.toHaveBeenCalled(); // no call to fetch is made because of feature flag check in uninstallPluginMeta
        expect(fetchMock).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/plugins/myorg-test-panel/uninstall',
            method: 'POST',
          })
        );
      });
    });
  });
});
