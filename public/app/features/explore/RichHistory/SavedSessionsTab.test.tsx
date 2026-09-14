import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { SavedSessionsTab } from './SavedSessionsTab';

const listExploreSessions = jest.fn();
const deleteExploreSession = jest.fn();
const renameExploreSession = jest.fn();
const locationPush = jest.fn();

jest.mock('app/core/exploreSessions/exploreSessionsApi', () => ({
  listExploreSessions: (...args: unknown[]) => listExploreSessions(...args),
  deleteExploreSession: (...args: unknown[]) => deleteExploreSession(...args),
  renameExploreSession: (...args: unknown[]) => renameExploreSession(...args),
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: () => ({
    location: { push: locationPush },
  }),
}));

const session = {
  uid: 'sess-1',
  name: 'Incident-123',
  url: '/explore?schemaVersion=1&panes=%7B%7D&orgId=1',
  panes: {},
  createdAt: 1,
  updatedAt: 1,
};

describe('SavedSessionsTab', () => {
  beforeEach(() => {
    listExploreSessions.mockReset();
    deleteExploreSession.mockReset();
    renameExploreSession.mockReset();
    locationPush.mockReset();
    listExploreSessions.mockResolvedValue([session]);
    deleteExploreSession.mockResolvedValue(undefined);
    renameExploreSession.mockResolvedValue({ ...session, name: 'Renamed' });
  });

  it('lists sessions and opens the saved URL', async () => {
    render(
      <TestProvider>
        <SavedSessionsTab />
      </TestProvider>
    );
    expect(await screen.findByText('Incident-123')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(locationPush).toHaveBeenCalledWith({
      pathname: '/explore',
      search: '?schemaVersion=1&panes=%7B%7D&orgId=1',
    });
  });

  it('deletes a session and refreshes the list', async () => {
    listExploreSessions.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    render(
      <TestProvider>
        <SavedSessionsTab />
      </TestProvider>
    );
    expect(await screen.findByText('Incident-123')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(deleteExploreSession).toHaveBeenCalledWith('sess-1');
    expect(await screen.findByText(/no saved sessions yet/i)).toBeInTheDocument();
  });
});
