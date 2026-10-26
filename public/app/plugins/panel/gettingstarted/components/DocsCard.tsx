import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { TextLink, useStyles2 } from '@grafana/ui';

import { type Card } from '../types';

import { CardStatus } from './CardStatus';
import { cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: Card;
  isNext: boolean;
}

export const DocsCard = ({ card, isNext }: Props) => {
  const styles = useStyles2(getStyles, card.done, isNext);

  return (
    <div className={styles.card}>
      <div className={cx(cardContent, styles.content)}>
        <a
          href={`${card.href}?utm_source=grafana_gettingstarted`}
          className={styles.url}
          onClick={() => reportInteraction('grafana_getting_started_docs', { title: card.title, link: card.href })}
        >
          <CardStatus label={card.heading} complete={card.done} isNext={isNext} />
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

const getStyles = (theme: GrafanaTheme2, complete: boolean, isNext: boolean) => {
  return {
    card: css({
      ...cardStyle(theme, complete, isNext),

      display: 'flex',
      flexDirection: 'column',
      width: '230px',

      [theme.breakpoints.down('md')]: {
        width: '192px',
      },
    }),
    content: css({
      flexGrow: 1,

      '&:has(> a:hover)': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    title: css({
      marginTop: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      color: 'inherit',
    }),
    url: css({
      display: 'block',
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
