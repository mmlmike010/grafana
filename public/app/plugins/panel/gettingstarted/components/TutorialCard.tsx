import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { type TutorialCardType } from '../types';

import { type CardVisualState, cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
  isNext?: boolean;
}

export const TutorialCard = ({ card, isNext = false }: Props) => {
  const state: CardVisualState = card.done ? 'complete' : isNext ? 'next' : 'pending';
  const styles = useStyles2(getStyles, state);

  return (
    <a
      className={styles.card}
      target="_blank"
      rel="noreferrer"
      href={`${card.href}?utm_source=grafana_gettingstarted`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => handleTutorialClick(event, card)}
      data-testid={isNext ? 'getting-started-next-step' : undefined}
    >
      <div className={cardContent}>
        <div className={styles.type}>{card.type}</div>
        <div className={styles.heading}>
          {card.done
            ? t('gettingstarted.tutorial-card.complete', 'complete')
            : isNext
              ? t('gettingstarted.tutorial-card.next-up', 'next up')
              : card.heading}
        </div>
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

const getStyles = (theme: GrafanaTheme2, state: CardVisualState) => {
  return {
    card: css({
      ...cardStyle(theme, state),
      width: '460px',
      minWidth: '460px',

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },

      [theme.breakpoints.down('xl')]: {
        minWidth: '368px',
      },

      [theme.breakpoints.down('lg')]: {
        minWidth: '272px',
      },
    }),
    type: css({
      color: theme.colors.primary.text,
      textTransform: 'uppercase',
    }),
    heading: css({
      textTransform: 'uppercase',
      color:
        state === 'complete'
          ? theme.colors.success.text
          : state === 'next'
            ? theme.colors.warning.text
            : theme.colors.text.secondary,
      marginBottom: theme.spacing(1),
      fontWeight: state === 'next' ? theme.typography.fontWeightBold : theme.typography.fontWeightMedium,
    }),
    cardTitle: css({
      marginBottom: theme.spacing(2),
      color: state === 'complete' ? theme.colors.text.secondary : theme.colors.text.primary,
    }),
    info: css({
      marginBottom: theme.spacing(2),
      color: state === 'complete' ? theme.colors.text.secondary : theme.colors.text.primary,
    }),
  };
};
