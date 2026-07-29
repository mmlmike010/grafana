import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { type SetupStep } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
}

export const Step = ({ step }: Props) => {
  const styles = useStyles2(getStyles);
  const completedCount = step.cards.filter((card) => card.done).length;
  const totalCount = step.cards.length;
  const nextCardIndex = step.cards.findIndex((card) => !card.done);
  const progressPercent = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.infoText}>{step.info}</p>
      </div>
      <div className={styles.checklist}>
        <div className={styles.progressHeader}>
          <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between" wrap="wrap">
            <div>
              <Text element="h3" variant="h4">
                {step.heading}
              </Text>
              <Text color="secondary" element="p" variant="bodySmall">
                {step.subheading}
              </Text>
            </div>
            <div
              className={styles.progressStatus}
              role="status"
              aria-label={`${completedCount} of ${totalCount} complete`}
              data-testid="getting-started-progress"
            >
              <Text weight="medium">
                <Trans i18nKey="gettingstarted.step.progress-status" values={{ completedCount, totalCount }}>
                  {'{{completedCount}}'} of {'{{totalCount}}'} complete
                </Trans>
              </Text>
            </div>
          </Stack>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
          >
            <div className={styles.progressFill(progressPercent)} />
          </div>
        </div>
        <div className={styles.cards}>
          {step.cards.map((card, index) => {
            const key = `${card.title}-${index}`;
            const isNext = index === nextCardIndex;
            if (card.type === 'tutorial') {
              return <TutorialCard key={key} card={card} isNext={isNext} />;
            }
            return <DocsCard key={key} card={card} isNext={isNext} />;
          })}
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    setup: css({
      display: 'flex',
      width: '100%',
      maxWidth: '1400px',
      padding: theme.spacing(1, 0, 2),
    }),
    info: css({
      width: '172px',
      marginRight: theme.spacing(3),
      flexShrink: 0,

      [theme.breakpoints.down('xxl')]: {
        marginRight: theme.spacing(3),
      },
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
    title: css({
      color: theme.colors.primary.text,
      marginBottom: theme.spacing(1),
    }),
    infoText: css({
      color: theme.colors.text.secondary,
      marginBottom: 0,
    }),
    checklist: css({
      flex: 1,
      minWidth: 0,
      padding: theme.spacing(2.5),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
      boxShadow: theme.shadows.z1,
    }),
    progressHeader: css({
      marginBottom: theme.spacing(3),
      paddingBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    }),
    progressStatus: css({
      padding: theme.spacing(0.5, 1.5),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      whiteSpace: 'nowrap',
    }),
    progressTrack: css({
      height: theme.spacing(1),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
    }),
    progressFill: (percent: number) =>
      css({
        height: '100%',
        width: `${percent}%`,
        backgroundColor: theme.colors.success.main,
        borderRadius: theme.shape.radius.pill,
        transition: 'width 200ms ease-out',
      }),
    cards: css({
      overflowX: 'auto',
      overflowY: 'hidden',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5, 0.5, 1),
    }),
  };
};
