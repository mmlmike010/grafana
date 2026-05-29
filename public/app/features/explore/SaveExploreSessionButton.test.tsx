import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { TestProvider } from 'test/helpers/TestProvider';

import { SaveExploreSessionButton } from './SaveExploreSessionButton';
import { QueriesDrawerContext, Tabs } from './QueriesDrawer/QueriesDrawerContext';

jest.mock('app/core/exploreSessions/exploreSessionsApi', () => ({
  createExploreSession: jest.fn().mockResolvedValue({ uid: 'abc' }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasAccessToExplore: () => true,
    user: { orgId: 1 },
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const stablePanes = {};
jest.mock('./state/selectors', () => ({
  selectPanes: () => stablePanes,
}));

describe('SaveExploreSessionButton', () => {
  it('opens modal and saves session', async () => {
    const setSelectedTab = jest.fn();
    const setDrawerOpened = jest.fn();

    render(
      <TestProvider>
        <QueriesDrawerContext.Provider
          value={{
            selectedTab: Tabs.RichHistory,
            setSelectedTab,
            drawerOpened: false,
            setDrawerOpened,
          }}
        >
          <SaveExploreSessionButton hideText={false} />
        </QueriesDrawerContext.Provider>
      </TestProvider>
    );

    await userEvent.click(screen.getByTestId(selectors.pages.Explore.toolbar.saveSession));
    await userEvent.type(screen.getByPlaceholderText(/session name/i), 'My session');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const { createExploreSession } = jest.requireMock('app/core/exploreSessions/exploreSessionsApi');
    expect(createExploreSession).toHaveBeenCalled();
    expect(setSelectedTab).toHaveBeenCalledWith(Tabs.SavedSessions);
    expect(setDrawerOpened).toHaveBeenCalledWith(true);
  });
});
