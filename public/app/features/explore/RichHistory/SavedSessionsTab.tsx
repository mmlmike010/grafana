import { useCallback, useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useGrafana } from 'app/core/context/GrafanaContext';
import {
  type ExploreSessionDTO,
  deleteExploreSession,
  listExploreSessions,
  renameExploreSession,
} from 'app/core/exploreSessions/exploreSessionsApi';
import { useStyles2, Button, Input, Stack } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: `${theme.spacing(1)} 0`,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  name: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});

export function SavedSessionsTab() {
  const styles = useStyles2(getStyles);
  const { location } = useGrafana();
  const [sessions, setSessions] = useState<ExploreSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingUid, setRenamingUid] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listExploreSessions();
      setSessions(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openSession = (session: ExploreSessionDTO) => {
    const q = session.url.indexOf('?');
    const search = q >= 0 ? session.url.slice(q) : '';
    location.push({ pathname: '/explore', search });
  };

  const onDelete = async (uid: string) => {
    await deleteExploreSession(uid);
    await refresh();
  };

  const startRename = (session: ExploreSessionDTO) => {
    setRenamingUid(session.uid);
    setRenameValue(session.name);
  };

  const commitRename = async (uid: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingUid(null);
      return;
    }
    await renameExploreSession(uid, trimmed);
    setRenamingUid(null);
    await refresh();
  };

  if (loading) {
    return (
      <div>
        <Trans i18nKey="explore.saved-sessions.loading">Loading saved sessions…</Trans>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div>
        <Trans i18nKey="explore.saved-sessions.empty">
          No saved sessions yet. Use &quot;Save session&quot; in the toolbar to store the current view.
        </Trans>
      </div>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      {sessions.map((session) => (
        <div key={session.uid} className={styles.row}>
          <div className={styles.name}>
            {renamingUid === session.uid ? (
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.currentTarget.value)}
                onBlur={() => commitRename(session.uid)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(session.uid)}
                autoFocus
              />
            ) : (
              session.name
            )}
          </div>
          <Stack direction="row" gap={1}>
            <Button size="sm" variant="primary" onClick={() => openSession(session)}>
              <Trans i18nKey="explore.saved-sessions.open">Open</Trans>
            </Button>
            <Button size="sm" variant="secondary" fill="outline" onClick={() => startRename(session)}>
              <Trans i18nKey="explore.saved-sessions.rename">Rename</Trans>
            </Button>
            <Button size="sm" variant="destructive" fill="outline" onClick={() => onDelete(session.uid)}>
              <Trans i18nKey="explore.saved-sessions.delete">Delete</Trans>
            </Button>
          </Stack>
        </div>
      ))}
    </Stack>
  );
}
