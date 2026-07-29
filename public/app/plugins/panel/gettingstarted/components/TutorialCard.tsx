import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';

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
        <div className={styles.headingRow}>
          <div className={styles.heading}>
            {card.done
              ? t('gettingstarted.tutorial-card.complete', 'complete')
              : isNext
                ? t('gettingstarted.tutorial-card.up-next', 'Up next')
                : card.heading}
          </div>
          {card.done && <Icon name="check-circle" className={styles.completeIcon} />}
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
    headingRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    heading: css({
      textTransform: 'uppercase',
      color:
        state === 'complete'
          ? theme.colors.success.text
          : state === 'next'
            ? theme.colors.primary.text
            : theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    completeIcon: css({
      color: theme.colors.success.text,
    }),
    cardTitle: css({
      marginBottom: theme.spacing(2),
    }),
    info: css({
      marginBottom: theme.spacing(2),
    }),
  };
};
