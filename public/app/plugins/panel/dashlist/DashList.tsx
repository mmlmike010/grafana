import { take } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useThrottle } from 'react-use';

import { type InterpolateFunction, type PanelProps, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ScrollContainer, Box, Text, EmptyState, LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import impressionSrv from 'app/core/services/impression_srv';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult, type QueryResponse, type SearchQuery } from 'app/features/search/service/types';

import { DashListItem } from './DashListItem';
import { type Options } from './panelcfg.gen';
import { useDashListUrlParams } from './utils';

export type Dashboard = DashboardQueryResult & {
  isSearchResult?: boolean;
  isRecent?: boolean;
  isStarred?: boolean;
};

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

async function fetchDashboards(options: Options, replaceVars: InterpolateFunction) {
  const searcher = getGrafanaSearcher();
  let starredDashboards: Promise<QueryResponse | void> = Promise.resolve();
  let recentDashboards: Promise<QueryResponse | void> = Promise.resolve();
  let searchedDashboards: Promise<QueryResponse | void> = Promise.resolve();

  if (options.showStarred) {
    const params: SearchQuery = { limit: options.maxItems, starred: true };
    starredDashboards = searcher.starred(params);
  }

  let dashUIDs: string[] = [];
  if (options.showRecentlyViewed) {
    let uids = await impressionSrv.getDashboardOpened();
    dashUIDs = take<string>(uids, options.maxItems);

    recentDashboards = searcher.search({ uid: dashUIDs, limit: options.maxItems, kind: ['dashboard'] });
  }

  if (options.showSearch) {
    const uid = options.folderUID === '' ? 'general' : options.folderUID;
    const params: SearchQuery = {
      limit: options.maxItems,
      query: replaceVars(options.query, {}, 'text'),
      location: uid,
      tags: options.tags.map((tag: string) => replaceVars(tag, {}, 'text')),
      kind: ['dashboard'],
    };

    searchedDashboards = searcher.search(params);
  }

  const [starred, searched, recent] = await Promise.allSettled([
    starredDashboards,
    searchedDashboards,
    recentDashboards,
  ]);

  // We deliberately deal with recent dashboards first so that the order of dash IDs is preserved
  let dashMap = new Map<string, DashboardQueryResult>();
  if (recent && recent.status === 'fulfilled') {
    for (const dashUID of dashUIDs) {
      const dash = recent.value?.view.find((d: DashboardQueryResult): d is DashboardQueryResult => {
        return d.uid === dashUID;
      });
      if (dash) {
        dashMap.set(dashUID, { ...dash, title: dash.name, isRecent: true });
      }
    }
  }

  if (searched && searched.status === 'fulfilled') {
    searched?.value?.view.forEach((dash) => {
      if (!dash.uid) {
        return;
      }
      if (dashMap.has(dash.uid)) {
        dashMap.get(dash.uid)!.isSearchResult = true;
      } else {
        dashMap.set(dash.uid, { ...dash, isSearchResult: true });
      }
    });
  }

  if (starred && starred.status === 'fulfilled') {
    starred?.value?.view.forEach((dash) => {
      if (!dash.uid) {
        return;
      }
      if (dashMap.has(dash.uid)) {
        dashMap.get(dash.uid)!.isStarred = true;
      } else {
        dashMap.set(dash.uid, { ...dash, isStarred: true });
      }
    });
  }

  return dashMap;
}

const collator = new Intl.Collator();

export function DashList(props: PanelProps<Options>) {
  const [dashboards, setDashboards] = useState(new Map<string, Dashboard>());
  const [isLoading, setIsLoading] = useState(true);

  const throttledRenderCount = useThrottle(props.renderCounter, 5000);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    fetchDashboards(props.options, props.replaceVariables)
      .then((dashes) => {
        if (isActive) {
          setDashboards(dashes);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [props.options, props.replaceVariables, throttledRenderCount]);

  const { foldersByUid } = useDashboardLocationInfo(props.options.showFolderNames && dashboards.size > 0);

  const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
    const dashboardList = [...dashboards.values()];
    const dashboardsGroupsMap: Record<string, Dashboard[]> = {
      starred: [],
      recent: [],
      searched: [],
    };

    for (const dash of dashboardList) {
      if (dash.isStarred) {
        dashboardsGroupsMap.starred.push(dash);
      }
      if (dash.isRecent) {
        dashboardsGroupsMap.recent.push(dash);
      }
      if (dash.isSearchResult) {
        dashboardsGroupsMap.searched.push(dash);
      }
    }
    return [
      dashboardsGroupsMap.starred.sort((a, b) => collator.compare(a.name, b.name)),
      dashboardsGroupsMap.recent,
      dashboardsGroupsMap.searched.sort((a, b) => collator.compare(a.name, b.name)),
    ];
  }, [dashboards]);

  const { showStarred, showRecentlyViewed, showHeadings, showFolderNames, showSearch } = props.options;

  const dashboardGroups: DashboardGroup[] = [
    {
      header: t('panel.dashlist.starred-dashboards', 'Starred dashboards'),
      dashboards: starredDashboards,
      show: showStarred,
    },
    {
      header: t('panel.dashlist.recently-viewed-dashboards', 'Recently viewed dashboards'),
      dashboards: recentDashboards,
      show: showRecentlyViewed,
    },
    {
      header: t('panel.dashlist.search', 'Search'),
      dashboards: searchedDashboards,
      show: showSearch,
    },
  ];

  const handleStarChange = (id: string, isStarred: boolean) => {
    const updatedDashboards = new Map(dashboards);
    updatedDashboards.set(id, { ...dashboards.get(id)!, isStarred });
    setDashboards(updatedDashboards);
  };

  const urlParams = useDashListUrlParams(props);

  const renderList = (dashboards: Dashboard[]) => (
    <ul>
      {dashboards.map((dash) => {
        let url = dash.url + urlParams;
        url = getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);

        const locationInfo = showFolderNames && dash.location ? foldersByUid[dash.location] : undefined;
        return (
          <li key={`dash-${dash.uid}`}>
            <DashListItem
              dashboard={dash}
              url={url}
              showFolderNames={showFolderNames}
              locationInfo={locationInfo}
              layoutMode="list"
              onStarChange={handleStarChange}
              source="dashListView"
            />
          </li>
        );
      })}
    </ul>
  );

  const showEmptyState = dashboardGroups.every(({ show }) => !show);
  const showNoDashboardsCTA =
    !isLoading &&
    dashboardGroups.some(({ show }) => show) &&
    dashboardGroups.every(({ show, dashboards }) => !show || dashboards.length === 0);

  return (
    <ScrollContainer minHeight="100%">
      {showEmptyState && (
        <EmptyState
          hideImage
          variant="call-to-action"
          message={t('panel.dashlist.empty-state-message', 'No dashboard groups configured')}
        />
      )}
      {showNoDashboardsCTA && (
        <EmptyState
          hideImage
          variant="call-to-action"
          message={t('panel.dashlist.no-dashboards-message', 'No dashboards yet')}
          button={
            <Stack direction="row" gap={1}>
              <LinkButton href="/dashboard/new" icon="plus">
                <Trans i18nKey="panel.dashlist.create-dashboard">Create your first dashboard</Trans>
              </LinkButton>
              <LinkButton href="/dashboard/import" icon="import" variant="secondary">
                <Trans i18nKey="panel.dashlist.import-dashboard">Import dashboard</Trans>
              </LinkButton>
            </Stack>
          }
        >
          <Trans i18nKey="panel.dashlist.no-dashboards-description">
            Start by creating a dashboard or importing one from a JSON file or Grafana.com.
          </Trans>
        </EmptyState>
      )}
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && !showNoDashboardsCTA && (
            <Box marginBottom={2} paddingTop={0.5} key={`dash-group-${i}`}>
              {showHeadings && (
                <Box marginRight={1} paddingX={1} paddingY={0.25}>
                  {/* this testid is only necessary because we cannot determine what heading level to use here without some kind of
                   top-level way to manage that across the application. these _should_ be headings, we just won't know what level they should be
                   without something global, so for now we're using a testid to target these in tests. */}
                  <Text data-testid="dashlist-header" variant="h6">
                    {header}
                  </Text>
                </Box>
              )}
              {renderList(dashboards)}
            </Box>
          )
      )}
    </ScrollContainer>
  );
}
