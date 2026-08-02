import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type SetupStep } from '../types';

import { DocsCard } from './DocsCard';
import { ProgressHeader } from './ProgressHeader';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
}

export const Step = ({ step }: Props) => {
  const styles = useStyles2(getStyles);
  const stepsDone = step.cards.filter((card) => card.done).length;
  const totalSteps = step.cards.length;
  const nextIncompleteIndex = step.cards.findIndex((card) => !card.done);

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.infoText}>{step.info}</p>
      </div>
      <div className={styles.checklist}>
        <ProgressHeader stepsDone={stepsDone} totalSteps={totalSteps} />
        <div className={styles.cards}>
          {step.cards.map((card, index) => {
            const key = `${card.title}-${index}`;
            const isNext = index === nextIncompleteIndex;
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
      width: '95%',
    }),
    info: css({
      width: '172px',
      marginRight: '5%',
      flexShrink: 0,

      [theme.breakpoints.down('xxl')]: {
        marginRight: theme.spacing(4),
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
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      padding: theme.spacing(2),
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
    cards: css({
      overflowX: 'auto',
      overflowY: 'hidden',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      gap: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
