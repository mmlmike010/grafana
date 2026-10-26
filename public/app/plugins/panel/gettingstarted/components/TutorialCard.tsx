import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { type TutorialCardType } from '../types';

import { CardStatus } from './CardStatus';
import { cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
  isNext: boolean;
}

export const TutorialCard = ({ card, isNext }: Props) => {
  const styles = useStyles2(getStyles, card.done, isNext);

  return (
    <a
      className={styles.card}
      target="_blank"
      rel="noreferrer"
      href={`${card.href}?utm_source=grafana_gettingstarted`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => handleTutorialClick(event, card)}
    >
      <div className={cardContent}>
        <CardStatus label={card.type} complete={card.done} isNext={isNext} />
        <div className={styles.heading}>{card.heading}</div>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
      </div>
    </a>
  );
};

const handleTutorialClick = (event: MouseEvent<HTMLAnchorElement>, card: TutorialCardType) => {
  const isSet = store.get(card.key);
  if (!isSet) {
    store.set(card.key, true);
  }
  reportInteraction('grafana_getting_started_tutorial', { title: card.title });
};

const getStyles = (theme: GrafanaTheme2, complete: boolean, isNext: boolean) => {
  return {
    card: css({
      ...cardStyle(theme, complete, isNext),
      width: '460px',

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },

      [theme.breakpoints.down('xl')]: {
        width: '368px',
      },

      [theme.breakpoints.down('lg')]: {
        width: '272px',
      },
    }),
    heading: css({
      ...theme.typography.bodySmall,
      textTransform: 'uppercase',
      color: complete ? theme.colors.text.secondary : theme.colors.primary.text,
      marginTop: theme.spacing(0.5),
      marginBottom: theme.spacing(1),
    }),
    cardTitle: css({
      marginBottom: theme.spacing(1),
      color: 'inherit',
    }),
    info: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(1),
    }),
  };
};
