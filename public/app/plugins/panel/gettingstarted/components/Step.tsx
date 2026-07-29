import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type SetupStep } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
}

export const Step = ({ step }: Props) => {
  const styles = useStyles2(getStyles);
  const nextCardIndex = step.cards.findIndex((card) => !card.done);

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.infoText}>{step.info}</p>
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
      width: '100%',
      gap: theme.spacing(3),
    }),
    info: css({
      width: '172px',
      flexShrink: 0,

      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
    title: css({
      color: theme.colors.primary.text,
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.h4.fontSize,
    }),
    infoText: css({
      color: theme.colors.text.secondary,
      marginBottom: 0,
    }),
    cards: css({
      overflowX: 'auto',
      overflowY: 'hidden',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      gap: theme.spacing(2.5),
      paddingBottom: theme.spacing(1),
      paddingTop: theme.spacing(0.5),
    }),
  };
};
