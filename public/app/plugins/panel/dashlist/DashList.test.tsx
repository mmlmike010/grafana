import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { resetGrafanaSearcher } from 'app/features/search/service/searcher';
import * as searcherModule from 'app/features/search/service/searcher';

import { getPanelProps } from '../test-utils';

import { DashList } from './DashList';
import { type Options } from './panelcfg.gen';

const [_, { folderA, folderA_dashbdD, dashbdE }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

const defaultOptions: Options = {
  includeVars: false,
  keepTime: false,
  maxItems: 10,
  query: '*',
  showFolderNames: false,
  showHeadings: false,
  showRecentlyViewed: false,
  showSearch: false,
  showStarred: false,
  tags: [],
};

/** Match star/unstar by prefix + quoted title (no RegExp from dashboard titles — CWE-1333). */
function matchesFavoriteButtonName(accessibleName: string, dashboardTitle: string, variant: 'mark' | 'unmark') {
  const n = accessibleName.trim().toLowerCase();
  const prefix = variant === 'unmark' ? 'unmark ' : 'mark ';
  const titleLower = dashboardTitle.toLowerCase();
  return (
    n.startsWith(prefix) && n.endsWith(' as favorite') && n.includes(`"${titleLower}"`)
  );
}

const findStarButton = (dashboardTitle: string, isStarred: boolean) =>
  screen.findByRole('button', {
    name: (accessibleName: string) =>
      matchesFavoriteButtonName(accessibleName, dashboardTitle, isStarred ? 'unmark' : 'mark'),
  });

const fixtures: Array<
  [
    // Test title
    string,
    // Feature toggle setup
    Parameters<typeof testWithFeatureToggles>[0],
  ]
> = [
  ['DashList - app platform APIs enabled', { enable: ['unifiedStorageSearchUI', 'starsFromAPIServer'] }],
  ['DashList - app platform APIs disabled', {}],
];
describe.each(fixtures)('%s', (_title, featureTogglesSetup) => {
  testWithFeatureToggles(featureTogglesSetup);

  it('renders different groups of dashboards', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showHeadings: true,
      showRecentlyViewed: true,
      showStarred: true,
      showSearch: true,
    });
    render(<DashList {...props} />);

    const headings = (await screen.findAllByTestId('dashlist-header')).map((heading) => heading.textContent);
    expect(headings).toEqual(['Starred dashboards', 'Recently viewed dashboards', 'Search']);
  });

  it('renders folder names', async () => {
    const props = getPanelProps({ ...defaultOptions, showStarred: true, showFolderNames: true });
    render(<DashList {...props} />);

    // Based on the fixtures, we expect to see a dashboard that's contained in folderA
    const [folderTitle] = await screen.findAllByText(folderA.item.title);
    expect(folderTitle).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: false,
      showRecentlyViewed: false,
      showSearch: false,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText('No dashboard groups configured')).toBeInTheDocument();
  });

  it('allows un-starring a dashboard', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
    });
    const { user } = render(<DashList {...props} />, {
      preloadedState: { navIndex: { starred: { text: 'Starred', children: [] } } },
    });

    const starButton = await findStarButton(folderA_dashbdD.item.title, true);

    await user.click(starButton);

    expect(screen.queryByText(folderA_dashbdD.item.title)).not.toBeInTheDocument();
  });

  it('allows starring a dashboard', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
      showSearch: true,
    });

    const { user } = render(<DashList {...props} />, {
      preloadedState: { navIndex: { starred: { text: 'Starred', children: [] } } },
    });

    const starButton = await findStarButton(dashbdE.item.title, false);

    await user.click(starButton);

    // We use `findAll` because the dashboard will appear in two sections (starred and search)
    // but this is fine, because there will have been none before starring it
    const [unmarkButton] = await screen.findAllByRole('button', {
      name: (accessibleName: string) => matchesFavoriteButtonName(accessibleName, dashbdE.item.title, 'unmark'),
    });
    expect(unmarkButton).toBeInTheDocument();
  });

  it('shows recently viewed dashboards', async () => {
    impressionSrv.addDashboardImpression(dashbdE.item.uid);
    const props = getPanelProps({
      ...defaultOptions,
      showRecentlyViewed: true,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText(dashbdE.item.title)).toBeInTheDocument();
  });
});

describe('DashList zero-dashboard CTA', () => {
  beforeEach(() => {
    jest.spyOn(searcherModule, 'getGrafanaSearcher').mockReturnValue({
      starred: jest.fn().mockResolvedValue({ view: [] }),
      search: jest.fn().mockResolvedValue({ view: [] }),
    } as unknown as ReturnType<typeof searcherModule.getGrafanaSearcher>);
    jest.spyOn(impressionSrv, 'getDashboardOpened').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetGrafanaSearcher();
  });

  it('surfaces create/import actions when no dashboards are available', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showHeadings: true,
      showStarred: true,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText('You have no dashboards yet')).toBeInTheDocument();
    expect(screen.getByTestId('dashlist-create-first-dashboard')).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByTestId('dashlist-import-dashboard')).toHaveAttribute('href', '/dashboard/import');
  });
});
