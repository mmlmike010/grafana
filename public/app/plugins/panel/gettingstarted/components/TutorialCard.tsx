import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Badge, Icon, useStyles2 } from '@grafana/ui';

import { type TutorialCardType } from '../types';

import { cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
  isNext?: boolean;
}

export const TutorialCard = ({ card, isNext = false }: Props) => {
  const styles = useStyles2(getStyles, card.done, isNext);

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
            {card.done ? t('gettingstarted.tutorial-card.complete', 'complete') : card.heading}
          </div>
          {card.done && <Icon name="check-circle" size="sm" className={styles.checkIcon} />}
          {isNext && (
            <Badge
              text={t('gettingstarted.tutorial-card.up-next', 'Up next')}
              color="blue"
              className={styles.nextBadge}
            />
          )}
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

const getStyles = (theme: GrafanaTheme2, complete: boolean, isNext: boolean) => {
  return {
    card: css({
      ...cardStyle(theme, complete, isNext),
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
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
      flexWrap: 'wrap',
    }),
    heading: css({
      textTransform: 'uppercase',
      color: isNext ? theme.colors.warning.text : theme.colors.primary.text,
      marginBottom: 0,
    }),
    checkIcon: css({
      color: theme.colors.success.text,
    }),
    nextBadge: css({
      marginLeft: 'auto',
    }),
    cardTitle: css({
      marginBottom: theme.spacing(2),
    }),
    info: css({
      marginBottom: theme.spacing(2),
    }),
  };
};
