import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';

import { SavedSessionsTab } from './SavedSessionsTab';

const listExploreSessions = jest.fn();
const deleteExploreSession = jest.fn();
const renameExploreSession = jest.fn();

jest.mock('app/core/exploreSessions/ExploreSessionsStorage', () => ({
  listExploreSessions: (...args: unknown[]) => listExploreSessions(...args),
  deleteExploreSession: (...args: unknown[]) => deleteExploreSession(...args),
  renameExploreSession: (...args: unknown[]) => renameExploreSession(...args),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

describe('SavedSessionsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listExploreSessions.mockResolvedValue({
      sessions: [
        {
          uid: 'abc123',
          name: 'Incident-123',
          url: '/explore?schemaVersion=1&panes=%7B%7D',
          panesJson: '{}',
          createdAt: 1700000000,
          updatedAt: 1700000000,
        },
      ],
      totalCount: 1,
    });
  });

  it('lists saved sessions and opens one', async () => {
    const user = userEvent.setup();
    render(<SavedSessionsTab />);

    expect(await screen.findByText('Incident-123')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(locationService.push).toHaveBeenCalledWith('/explore?schemaVersion=1&panes=%7B%7D');
  });

  it('deletes a saved session', async () => {
    const user = userEvent.setup();
    deleteExploreSession.mockResolvedValue(undefined);
    listExploreSessions
      .mockResolvedValueOnce({
        sessions: [
          {
            uid: 'abc123',
            name: 'Incident-123',
            url: '/explore?panes={}',
            panesJson: '{}',
            createdAt: 1700000000,
            updatedAt: 1700000000,
          },
        ],
        totalCount: 1,
      })
      .mockResolvedValueOnce({ sessions: [], totalCount: 0 });

    render(<SavedSessionsTab />);
    expect(await screen.findByText('Incident-123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteExploreSession).toHaveBeenCalledWith('abc123'));
  });
});
