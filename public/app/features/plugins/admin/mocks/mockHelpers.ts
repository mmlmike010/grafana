import { of } from 'rxjs';

import { type BackendSrvRequest, setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { API_ROOT, GCOM_API_ROOT } from '../constants';
import * as permissions from '../permissions';
import {
  type CatalogPlugin,
  type LocalPlugin,
  type RemotePlugin,
  type Version,
  type ReducerState,
  RequestStatus,
} from '../types';

import catalogPluginMock from './catalogPlugin.mock';
import localPluginMock from './localPlugin.mock';
import remotePluginMock from './remotePlugin.mock';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns a sample mock for a CatalogPlugin plugin with the possibility to extend it
export const getCatalogPluginMock = (overrides?: Partial<CatalogPlugin>) => ({ ...catalogPluginMock, ...overrides });

// Returns a sample mock for a local (installed) plugin with the possibility to extend it
export const getLocalPluginMock = (overrides?: Partial<LocalPlugin>) => ({ ...localPluginMock, ...overrides });

// Returns a sample mock for a remote plugin with the possibility to extend it
export const getRemotePluginMock = (overrides?: Partial<RemotePlugin>) => ({ ...remotePluginMock, ...overrides });

// Returns a mock for the Redux store state of plugins
export const getPluginsStateMock = (plugins: CatalogPlugin[] = []): ReducerState => ({
  // @ts-ignore - We don't need the rest of the properties here as we are using the "new" reducer (public/app/features/plugins/admin/state/reducer.ts)
  items: {
    ids: plugins.map(({ id }) => id),
    entities: plugins.reduce((prev, current) => ({ ...prev, [current.id]: current }), {}),
  },
  requests: {
    'plugins/fetchAll': {
      status: RequestStatus.Fulfilled,
    },
    'plugins/fetchDetails': {
      status: RequestStatus.Fulfilled,
    },
    'plugins/fetchPluginInsights': {
      status: RequestStatus.Fulfilled,
    },
  },
  // Backward compatibility
  plugins: [],
  errors: [],
  searchQuery: '',
  hasFetched: false,
  dashboards: [],
  isLoadingPluginDashboards: false,
  panels: {},
});

// Mocks a plugin by considering what needs to be mocked from GCOM and what needs to be mocked locally (local Grafana API)
export const mockPluginApis = ({
  remote: remoteOverride,
  local: localOverride,
  versions,
}: {
  remote?: Partial<RemotePlugin>;
  local?: Partial<LocalPlugin>;
  versions?: Version[];
}) => {
  const remote = getRemotePluginMock(remoteOverride);
  const local = getLocalPluginMock(localOverride);
  const original = jest.requireActual('@grafana/runtime');
  const base = original.getBackendSrv() ?? backendSrv;
  // Preserve BackendSrv prototype methods (spread alone drops `get`, `post`, etc.).
  const stub = Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
    get: (path: string) => {
      if (path === '/api/frontend/settings') {
        return Promise.resolve({ panels: {} });
      }
      const settingsGetRe = /^\/api\/plugins\/([^/]+)\/settings$/;
      const settingsGetMatch = path.match(settingsGetRe);
      if (settingsGetMatch) {
        const pluginId = settingsGetMatch[1];
        return Promise.resolve({
          ...local,
          id: pluginId,
          type: local.id === pluginId ? local.type : 'datasource',
        });
      }
      return base.get(path);
    },
    fetch: (options: BackendSrvRequest) => {
      const path = options.url.split('?')[0];

      const gcomPluginsList = `${GCOM_API_ROOT}/plugins`;
      if (path === gcomPluginsList) {
        return of({ data: { items: [remote] }, ok: true, status: 200 } as any);
      }

      const gcomSingleRe = new RegExp(`^${escapeRegex(GCOM_API_ROOT)}/plugins/([^/]+)$`);
      const gcomSingleMatch = path.match(gcomSingleRe);
      if (gcomSingleMatch) {
        const slug = gcomSingleMatch[1];
        return of({ data: { ...remote, slug }, ok: true, status: 200 } as any);
      }

      const gcomVersionsRe = new RegExp(`^${escapeRegex(GCOM_API_ROOT)}/plugins/([^/]+)/versions$`);
      const gcomVersionsMatch = path.match(gcomVersionsRe);
      if (gcomVersionsMatch) {
        const items = versions ?? [
          { version: '1.0.0', createdAt: '', updatedAt: '', isCompatible: true, grafanaDependency: '>=8.0.0' },
        ];
        return of({ data: { items }, ok: true, status: 200 } as any);
      }

      const gcomVersionRe = new RegExp(
        `^${escapeRegex(GCOM_API_ROOT)}/plugins/([^/]+)/versions/([^/]+)$`
      );
      const gcomVersionMatch = path.match(gcomVersionRe);
      if (gcomVersionMatch) {
        const [, slug, version] = gcomVersionMatch;
        return of({
          data: {
            version,
            createdAt: '',
            updatedAt: '',
            isCompatible: true,
            grafanaDependency: '>=8.0.0',
            angularDetected: false,
            status: 'published',
          },
          ok: true,
          status: 200,
        } as any);
      }

      // Mock plugin insights - return empty insights to avoid API call errors
      if (path.includes('/insights')) {
        return of({ data: { id: 1, name: '', version: '', insights: [] }, ok: true, status: 200 } as any);
      }

      const settingsRe = new RegExp(`^${escapeRegex(API_ROOT)}/([^/]+)/settings$`);
      const settingsMatch = path.match(settingsRe);
      if (settingsMatch) {
        const pluginId = settingsMatch[1];
        if (local && pluginId === local.id) {
          return of({ data: local, ok: true, status: 200 } as any);
        }
        return of({ data: { ...local, id: pluginId }, ok: true, status: 200 } as any);
      }

      if (path === API_ROOT || path.startsWith(`${API_ROOT}?`)) {
        return of({ data: [local], ok: true, status: 200 } as any);
      }

      // Markdown / errors / instance routes used by plugin admin RTK Query
      if (path.endsWith('/markdown/README') || path.endsWith('/markdown/CHANGELOG')) {
        return of({ data: '', ok: true, status: 200 } as any);
      }
      if (path === `${API_ROOT}/errors`) {
        return of({ data: [], ok: true, status: 200 } as any);
      }

      if (path === '/api/instance/plugins') {
        return of({ data: { items: [] }, ok: true, status: 200 } as any);
      }
      if (path === '/api/instance/provisioned-plugins') {
        return of({ data: { items: [] }, ok: true, status: 200 } as any);
      }

      if (options.method === 'POST' && path.includes('/install')) {
        return of({ data: {}, ok: true, status: 200 } as any);
      }
      if (options.method === 'POST' && path.includes('/uninstall')) {
        return of({ data: {}, ok: true, status: 200 } as any);
      }

      return base.fetch(options);
    },
  });

  setBackendSrv(stub);
};

type UserAccessTestContext = {
  isAdmin: boolean;
  isOrgAdmin: boolean;
  isDataSourceEditor: boolean;
};

jest.mock('../permissions');

export function mockUserPermissions(options: UserAccessTestContext): void {
  const mock = jest.mocked(permissions);
  mock.isDataSourceEditor.mockReturnValue(options.isDataSourceEditor);
  mock.isOrgAdmin.mockReturnValue(options.isOrgAdmin);
  mock.isGrafanaAdmin.mockReturnValue(options.isAdmin);
}
