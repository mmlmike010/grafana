import { useState } from 'react';
import { useSelector } from 'react-redux';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Modal, ToolbarButton, Input } from '@grafana/ui';
import { createExploreSession } from 'app/core/exploreSessions/exploreSessionsApi';
import { contextSrv } from 'app/core/services/context_srv';
import { type StoreState } from 'app/types/store';

import { Tabs, useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';
import { selectPanes } from './state/selectors';
import { buildExplorePanesObjectForSave, constructExploreSessionUrlToSave } from './utils/links';

type Props = {
  hideText: boolean;
};

export function SaveExploreSessionButton({ hideText }: Props) {
  const panes = useSelector(selectPanes);
  const orgId = useSelector((state: StoreState) => state.user.orgId);
  const { setDrawerOpened, setSelectedTab } = useQueriesDrawerContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!contextSrv.hasAccessToExplore()) {
    return null;
  }

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSaving(true);
    try {
      const url = constructExploreSessionUrlToSave(panes);
      const panesObj = buildExplorePanesObjectForSave(panes);
      await createExploreSession({
        name: trimmed,
        url,
        panes: panesObj as Record<string, unknown>,
      });
      reportInteraction('grafana_explore_session_saved', { orgId });
      setOpen(false);
      setName('');
      setSelectedTab(Tabs.SavedSessions);
      setDrawerOpened(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToolbarButton
        variant="canvas"
        tooltip={t('explore.save-session.tooltip', 'Save current Explore session')}
        icon="save"
        onClick={() => setOpen(true)}
        data-testid={selectors.pages.Explore.toolbar.saveSession}
      >
        {hideText ? undefined : <Trans i18nKey="explore.save-session.button">Save session</Trans>}
      </ToolbarButton>
      <Modal title={t('explore.save-session.modal-title', 'Save Explore session')} isOpen={open} onDismiss={() => setOpen(false)}>
        <Input
          placeholder={t('explore.save-session.name-placeholder', 'Session name')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={() => setOpen(false)}>
            <Trans i18nKey="explore.save-session.cancel">Cancel</Trans>
          </Button>
          <Button variant="primary" onClick={onSave} disabled={!name.trim() || saving}>
            <Trans i18nKey="explore.save-session.save">Save</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}
