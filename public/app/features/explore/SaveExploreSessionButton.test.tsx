import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SaveExploreSessionButton } from './SaveExploreSessionButton';

const createExploreSession = jest.fn();
const setDrawerOpened = jest.fn();
const setSelectedTab = jest.fn();

jest.mock('app/core/exploreSessions/ExploreSessionsStorage', () => ({
  createExploreSession: (...args: unknown[]) => createExploreSession(...args),
}));

jest.mock('./QueriesDrawer/QueriesDrawerContext', () => ({
  Tabs: {
    SavedSessions: 'Saved sessions',
  },
  useQueriesDrawerContext: () => ({
    setDrawerOpened,
    setSelectedTab,
  }),
}));

jest.mock('./utils/links', () => ({
  constructAbsoluteUrl: () => '/explore?schemaVersion=1&panes=%7B%7D',
}));

jest.mock('./hooks/useStateSync/external.utils', () => ({
  getUrlStateFromPaneState: () => ({
    datasource: 'loki',
    queries: [],
    range: { from: 'now-1h', to: 'now' },
  }),
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      explore: {
        panes: {
          abc: {
            datasourceInstance: { uid: 'loki' },
            queries: [],
            range: { from: { valueOf: () => 1 }, to: { valueOf: () => 2 }, raw: { from: 'now-1h', to: 'now' } },
            panelsState: {},
            compact: false,
          },
        },
      },
    }),
}));

describe('SaveExploreSessionButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createExploreSession.mockResolvedValue({
      uid: 'abc123',
      name: 'Incident-123',
      url: '/explore?schemaVersion=1&panes=%7B%7D',
      panesJson: '{}',
      createdAt: 1,
      updatedAt: 1,
    });
  });

  it('opens modal and saves a named session', async () => {
    const user = userEvent.setup();
    render(<SaveExploreSessionButton hideText={false} />);

    await user.click(screen.getByRole('button', { name: 'Save session' }));
    await user.type(screen.getByLabelText('Session name'), 'Incident-123');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(createExploreSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Incident-123',
        url: '/explore?schemaVersion=1&panes=%7B%7D',
      })
    );
    expect(setSelectedTab).toHaveBeenCalledWith('Saved sessions');
    expect(setDrawerOpened).toHaveBeenCalledWith(true);
  });
});
