import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Input, Modal, ToolbarButton } from '@grafana/ui';
import { createExploreSession } from 'app/core/exploreSessions/ExploreSessionsStorage';
import { useSelector } from 'app/types/store';

import { getUrlStateFromPaneState } from './hooks/useStateSync/external.utils';
import { Tabs, useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { selectPanes } from './state/selectors';
import { constructAbsoluteUrl } from './utils/links';

export function SaveExploreSessionButton({ hideText }: { hideText: boolean }) {
  const panes = useSelector(selectPanes);
  const { setDrawerOpened, setSelectedTab } = useQueriesDrawerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('explore.toolbar.save-session-name-required', 'Name is required'));
      return;
    }

    setIsSaving(true);
    setError(undefined);
    try {
      const url = constructAbsoluteUrl(panes);
      const panesState = Object.fromEntries(
        Object.entries(panes)
          .filter((entry): entry is [string, NonNullable<(typeof panes)[string]>] => entry[1] !== undefined)
          .map(([id, pane]) => [id, getUrlStateFromPaneState(pane)])
      );

      await createExploreSession({
        name: trimmed,
        url,
        panesJson: JSON.stringify(panesState),
      });

      reportInteraction('grafana_explore_session_saved');
      setIsOpen(false);
      setName('');
      setSelectedTab(Tabs.SavedSessions);
      setDrawerOpened(true);
    } catch {
      setError(t('explore.toolbar.save-session-error', 'Failed to save session'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ToolbarButton
        icon="save"
        variant="canvas"
        onClick={() => setIsOpen(true)}
        aria-label={t('explore.toolbar.save-session', 'Save session')}
        tooltip={t('explore.toolbar.save-session', 'Save session')}
        data-testid="explore-save-session-button"
      >
        {!hideText && <Trans i18nKey="explore.toolbar.save-session-label">Save session</Trans>}
      </ToolbarButton>
      <Modal
        title={t('explore.toolbar.save-session-modal-title', 'Save Explore session')}
        isOpen={isOpen}
        onDismiss={() => {
          setIsOpen(false);
          setError(undefined);
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder={t('explore.toolbar.save-session-name-placeholder', 'e.g. Incident-123')}
          aria-label={t('explore.toolbar.save-session-name', 'Session name')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void onSave();
            }
          }}
        />
        {error && <div role="alert">{error}</div>}
        <Modal.ButtonRow>
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => {
              setIsOpen(false);
              setError(undefined);
            }}
          >
            <Trans i18nKey="explore.toolbar.save-session-cancel">Cancel</Trans>
          </Button>
          <Button onClick={() => void onSave()} disabled={isSaving}>
            <Trans i18nKey="explore.toolbar.save-session-confirm">Save</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}
