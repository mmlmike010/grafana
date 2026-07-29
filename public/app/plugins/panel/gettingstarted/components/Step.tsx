import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

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
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.infoText}>{step.info}</p>
        <div className={styles.progress} aria-live="polite">
          <div className={styles.progressLabel}>
            {t('gettingstarted.step.progress', '{{complete}} of {{total}} complete', {
              complete: completedCount,
              total: totalCount,
            })}
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={t('gettingstarted.step.progress-aria-label', 'Setup progress')}
          >
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
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
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    setup: css({
      display: 'flex',
      width: '95%',
      gap: theme.spacing(2),
    }),
    info: css({
      width: '200px',
      flexShrink: 0,
      marginRight: theme.spacing(2),
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,

      [theme.breakpoints.down('xxl')]: {
        marginRight: theme.spacing(1),
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
      marginBottom: theme.spacing(2),
    }),
    progress: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
      paddingTop: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    progressLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    progressTrack: css({
      width: '100%',
      height: '6px',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.canvas,
      overflow: 'hidden',
    }),
    progressFill: css({
      height: '100%',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.primary.main,
      transition: theme.transitions.create('width', {
        duration: theme.transitions.duration.short,
      }),
    }),
    cards: css({
      overflowX: 'auto',
      overflowY: 'hidden',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
