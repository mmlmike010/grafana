import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, FilterInput, IconButton, Input, Spinner, Stack, useStyles2 } from '@grafana/ui';
import {
  deleteExploreSession,
  listExploreSessions,
  renameExploreSession,
  type ExploreSessionDTO,
} from 'app/core/exploreSessions/ExploreSessionsStorage';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '100%',
  }),
  filterInput: css({
    marginBottom: theme.spacing(1),
  }),
  card: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  name: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  meta: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  empty: css({
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
});

export function SavedSessionsTab() {
  const styles = useStyles2(getStyles);
  const [sessions, setSessions] = useState<ExploreSessionDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [renamingUid, setRenamingUid] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState('');

  const loadSessions = useCallback(async (searchString: string) => {
    setLoading(true);
    try {
      const result = await listExploreSessions(searchString);
      setSessions(result.sessions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions('');
  }, [loadSessions]);

  const onOpen = (session: ExploreSessionDTO) => {
    const path = session.url.startsWith('/') ? session.url : `/${session.url}`;
    locationService.push(path);
  };

  const onDelete = async (uid: string) => {
    await deleteExploreSession(uid);
    await loadSessions(search);
  };

  const onRenameSubmit = async (uid: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      return;
    }
    await renameExploreSession(uid, trimmed);
    setRenamingUid(undefined);
    setRenameValue('');
    await loadSessions(search);
  };

  return (
    <div className={styles.container} data-testid="explore-saved-sessions-tab">
      <div className={styles.filterInput}>
        <FilterInput
          escapeRegex={false}
          placeholder={t('explore.saved-sessions.search-placeholder', 'Search saved sessions')}
          value={search}
          onChange={(value: string) => {
            setSearch(value);
            void loadSessions(value);
          }}
        />
      </div>
      {loading && <Spinner />}
      {!loading && sessions.length === 0 && (
        <div className={styles.empty}>
          <Trans i18nKey="explore.saved-sessions.empty">
            No saved sessions yet. Use &quot;Save session&quot; in the toolbar to create one.
          </Trans>
        </div>
      )}
      {!loading &&
        sessions.map((session) => (
          <div className={styles.card} key={session.uid} data-testid={`explore-saved-session-${session.uid}`}>
            <Stack direction="column" gap={0.5}>
              {renamingUid === session.uid ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void onRenameSubmit(session.uid);
                    }
                  }}
                  aria-label={t('explore.saved-sessions.rename-input', 'Rename session')}
                />
              ) : (
                <span className={styles.name}>{session.name}</span>
              )}
              <span className={styles.meta}>{dateTimeFormat(session.updatedAt * 1000)}</span>
            </Stack>
            <Stack direction="row" gap={0.5}>
              {renamingUid === session.uid ? (
                <Button size="sm" onClick={() => void onRenameSubmit(session.uid)}>
                  <Trans i18nKey="explore.saved-sessions.rename-confirm">Rename</Trans>
                </Button>
              ) : (
                <IconButton
                  name="pen"
                  aria-label={t('explore.saved-sessions.rename', 'Rename')}
                  tooltip={t('explore.saved-sessions.rename', 'Rename')}
                  onClick={() => {
                    setRenamingUid(session.uid);
                    setRenameValue(session.name);
                  }}
                />
              )}
              <Button size="sm" variant="secondary" onClick={() => onOpen(session)}>
                <Trans i18nKey="explore.saved-sessions.open">Open</Trans>
              </Button>
              <IconButton
                name="trash-alt"
                aria-label={t('explore.saved-sessions.delete', 'Delete')}
                tooltip={t('explore.saved-sessions.delete', 'Delete')}
                onClick={() => void onDelete(session.uid)}
              />
            </Stack>
          </div>
        ))}
    </div>
  );
}
