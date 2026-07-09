import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { DataFrameView, FieldType, type DataFrame } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher, resetGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult, type QueryResponse } from 'app/features/search/service/types';

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

const findStarButton = (title: string, isStarred: boolean) =>
  screen.findByRole('button', { name: new RegExp(`^${isStarred ? 'unmark' : 'mark'} "${title}" as favorite`, 'i') });

const emptySearchResponse = (): QueryResponse => {
  const data: DataFrame = {
    fields: [
      { name: 'kind', type: FieldType.string, config: {}, values: [] },
      { name: 'name', type: FieldType.string, config: {}, values: [] },
      { name: 'uid', type: FieldType.string, config: {}, values: [] },
      { name: 'url', type: FieldType.string, config: {}, values: [] },
      { name: 'tags', type: FieldType.other, config: {}, values: [] },
      { name: 'location', type: FieldType.string, config: {}, values: [] },
    ],
    length: 0,
  };

  return {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: 0,
    view: new DataFrameView<DashboardQueryResult>(data),
  };
};

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

  afterEach(() => {
    jest.restoreAllMocks();
    resetGrafanaSearcher();
  });

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

  it('renders create dashboard CTA when there are no dashboards', async () => {
    jest.spyOn(getGrafanaSearcher(), 'starred').mockResolvedValue(emptySearchResponse());
    jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(emptySearchResponse());

    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText("You haven't created any dashboards yet")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first dashboard' })).toHaveAttribute('href', 'dashboard/new');
  });

  it('does not render create dashboard CTA when dashboard groups are empty but dashboards exist', async () => {
    jest.spyOn(getGrafanaSearcher(), 'starred').mockResolvedValue(emptySearchResponse());
    jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue({
      ...emptySearchResponse(),
      totalRows: 1,
    });

    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
    });
    render(<DashList {...props} />);

    await waitFor(() => expect(screen.queryByText("You haven't created any dashboards yet")).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Create your first dashboard' })).not.toBeInTheDocument();
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
      name: new RegExp(`^unmark "${dashbdE.item.title}" as favorite`, 'i'),
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
