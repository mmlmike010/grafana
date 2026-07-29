import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { ProgressHeader } from './components/ProgressHeader';
import { Step } from './components/Step';
import { getSteps } from './steps';
import { type SetupStep } from './types';

export function GettingStarted(props: PanelProps) {
  const styles = useStyles2(getStyles);
  const [checksDone, setChecksDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<SetupStep[]>(() => getSteps());

  useEffect(() => {
    let cancelled = false;

    const checkSteps = async () => {
      const uncheckedSteps = getSteps();
      const checkedStepsPromises: Array<Promise<SetupStep>> = uncheckedSteps.map(async (step: SetupStep) => {
        const checkedCardsPromises = step.cards.map(async (card) => {
          return card.check().then((passed) => {
            return { ...card, done: passed };
          });
        });
        const checkedCards = await Promise.all(checkedCardsPromises);
        return {
          ...step,
          done: checkedCards.every((c) => c.done),
          cards: checkedCards,
        };
      });

      const checkedSteps = await Promise.all(checkedStepsPromises);
      if (cancelled) {
        return;
      }

      setCurrentStep(!checkedSteps[0].done ? 0 : 1);
      setSteps(checkedSteps);
      setChecksDone(true);
    };

    checkSteps();

    return () => {
      cancelled = true;
    };
  }, []);

  const onForwardClick = () => {
    reportInteraction('grafana_getting_started_button_to_advanced_tutorials');
    setCurrentStep((prev) => prev + 1);
  };

  const onPreviousClick = () => {
    reportInteraction('grafana_getting_started_button_to_basic_tutorials');
    setCurrentStep((prev) => prev - 1);
  };

  const dismiss = () => {
    const { id } = props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(id);

    reportInteraction('grafana_getting_started_remove_panel');

    dashboard?.removePanel(panel!);

    backendSrv.put('/api/user/helpflags/1', undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
    });
  };

  const step = steps[currentStep];
  const stepsDone = step.cards.filter((card) => card.done).length;
  const totalSteps = step.cards.length;

  return (
    <div className={styles.container}>
      {!checksDone ? (
        <div className={styles.loading}>
          <div className={styles.loadingText}>
            <Trans i18nKey="gettingstarted.getting-started.checking-completed-setup-steps">
              Checking completed setup steps
            </Trans>
          </div>
          <Spinner size="xl" inline />
        </div>
      ) : (
        <div className={styles.checklist}>
          <Button size="sm" fill="text" className={styles.dismiss} onClick={dismiss}>
            <Trans i18nKey="gettingstarted.getting-started.remove-this-panel">Remove this panel</Trans>
          </Button>
          {currentStep === steps.length - 1 && (
            <Button
              className={cx(styles.backForwardButtons, styles.previous)}
              onClick={onPreviousClick}
              aria-label={t('gettingstarted.getting-started.aria-label-to-basic-tutorials', 'To basic tutorials')}
              icon="angle-left"
              variant="secondary"
            />
          )}
          <ProgressHeader
            heading={step.heading}
            subheading={step.subheading}
            stepsDone={stepsDone}
            totalSteps={totalSteps}
          />
          <div className={styles.content}>
            <Step step={step} />
          </div>
          {currentStep < steps.length - 1 && (
            <Button
              className={cx(styles.backForwardButtons, styles.forward)}
              onClick={onForwardClick}
              aria-label={t(
                'gettingstarted.getting-started.aria-label-to-advanced-tutorials',
                'To advanced tutorials'
              )}
              icon="angle-right"
              variant="secondary"
            />
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundSize: 'cover',
      padding: `${theme.spacing(2)} ${theme.spacing(2)} ${theme.spacing(2)}`,
    }),
    checklist: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: theme.spacing(2.5, 2.5, 2),
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z1,
    }),
    content: css({
      label: 'content',
      display: 'flex',
      justifyContent: 'center',
      flexGrow: 1,

      [theme.breakpoints.down('xxl')]: {
        marginLeft: theme.spacing(3),
        justifyContent: 'flex-start',
      },
    }),
    backForwardButtons: css({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 1,
    }),
    previous: css({
      left: theme.spacing(1),
      [theme.breakpoints.down('md')]: {
        left: 0,
      },
    }),
    forward: css({
      right: theme.spacing(1),
      [theme.breakpoints.down('md')]: {
        right: 0,
      },
    }),
    dismiss: css({
      alignSelf: 'flex-end',
      marginBottom: theme.spacing(0.5),
    }),
    loading: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    }),
    loadingText: css({
      marginRight: theme.spacing(1),
    }),
  };
};
