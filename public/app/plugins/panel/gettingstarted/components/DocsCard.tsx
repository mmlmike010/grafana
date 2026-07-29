import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, TextLink, useStyles2 } from '@grafana/ui';

import { type Card } from '../types';

import { type CardVisualState, cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: Card;
  isNext?: boolean;
}

export const DocsCard = ({ card, isNext = false }: Props) => {
  const state: CardVisualState = card.done ? 'complete' : isNext ? 'next' : 'pending';
  const styles = useStyles2(getStyles, state);

  return (
    <div className={styles.card} data-testid={isNext ? 'getting-started-next-step' : undefined}>
      <div className={cx(cardContent, styles.content)}>
        <a
          href={`${card.href}?utm_source=grafana_gettingstarted`}
          className={styles.url}
          onClick={() => reportInteraction('grafana_getting_started_docs', { title: card.title, link: card.href })}
        >
          <div className={styles.headingRow}>
            <div className={styles.heading}>
              {card.done
                ? t('gettingstarted.docs-card.complete', 'complete')
                : isNext
                  ? t('gettingstarted.docs-card.up-next', 'Up next')
                  : card.heading}
            </div>
            {card.done && <Icon name="check-circle" className={styles.completeIcon} />}
          </div>
          <h4 className={styles.title}>{card.title}</h4>
        </a>
      </div>
      <div className={styles.learnUrl}>
        <TextLink
          href={`${card.learnHref}?utm_source=grafana_gettingstarted`}
          external
          inline={false}
          onClick={() => reportInteraction('grafana_getting_started_docs', { title: card.title, link: card.learnHref })}
        >
          <Trans i18nKey="gettingstarted.docs-card.learn-how">Learn how in the docs</Trans>
        </TextLink>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, state: CardVisualState) => {
  return {
    card: css({
      ...cardStyle(theme, state),

      display: 'flex',
      flexDirection: 'column',
      minWidth: '230px',

      [theme.breakpoints.down('md')]: {
        minWidth: '192px',
      },
    }),
    content: css({
      flexGrow: 1,

      '&:has(> a:hover)': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    headingRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    }),
    heading: css({
      textTransform: 'uppercase',
      color:
        state === 'complete'
          ? theme.colors.success.text
          : state === 'next'
            ? theme.colors.primary.text
            : '#FFB357',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    completeIcon: css({
      color: theme.colors.success.text,
    }),
    title: css({
      marginBottom: theme.spacing(2),
    }),
    url: css({
      display: 'inline-block',
      height: '100%',
    }),
    learnUrl: css({
      a: {
        borderTop: `1px solid ${theme.colors.border.weak}`,
        display: 'inline-block',
        padding: theme.spacing(1, 2),
        width: '100%',
      },
    }),
  };
};
