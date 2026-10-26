import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { type SetupStep } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
  actions?: ReactNode;
}

export const Step = ({ step, actions }: Props) => {
  const total = step.cards.length;
  const completed = step.cards.filter((card) => card.done).length;
  const nextIndex = step.cards.findIndex((card) => !card.done);
  const styles = useStyles2(getStyles, total ? completed / total : 0, completed === total);
  const progressLabel = t('gettingstarted.step.progress', '{{completed}} of {{total}} complete', { completed, total });

  return (
    <div className={styles.setup}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>{step.title}</h2>
          <span className={styles.count}>{progressLabel}</span>
          <span className={styles.info}>{step.info}</span>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
        >
          <div className={styles.fill} />
        </div>
      </div>
      <div className={styles.cards}>
        {step.cards.map((card, index) => {
          const key = `${card.title}-${index}`;
          const isNext = index === nextIndex;
          if (card.type === 'tutorial') {
            return <TutorialCard key={key} card={card} isNext={isNext} />;
          }
          return <DocsCard key={key} card={card} isNext={isNext} />;
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, ratio: number, allDone: boolean) => {
  return {
    setup: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      width: '100%',
      minWidth: 0,
    }),
    header: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'baseline',
      gap: theme.spacing(1.5),
      minWidth: 0,
    }),
    title: css({
      ...theme.typography.h4,
      margin: 0,
      color: theme.colors.text.primary,
    }),
    count: css({
      ...theme.typography.bodySmall,
      fontWeight: theme.typography.fontWeightMedium,
      color: allDone ? theme.colors.success.text : theme.colors.primary.text,
      whiteSpace: 'nowrap',
    }),
    info: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',

      [theme.breakpoints.down('md')]: {
        display: 'none',
      },
    }),
    actions: css({
      marginLeft: 'auto',
      alignSelf: 'center',
    }),
    track: css({
      height: theme.spacing(0.75),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.border.weak,
      overflow: 'hidden',
    }),
    fill: css({
      height: '100%',
      width: `${Math.round(ratio * 100)}%`,
      borderRadius: theme.shape.radius.pill,
      backgroundColor: allDone ? theme.colors.success.main : theme.colors.primary.main,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create('width'),
      },
    }),
    cards: css({
      overflowX: 'auto',
      overflowY: 'hidden',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      gap: theme.spacing(2),
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
