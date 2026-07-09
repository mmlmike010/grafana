import { css } from '@emotion/css';

import { type FieldSparkline, FieldType, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, Sparkline, Text, TextLink, useStyles2, useTheme2 } from '@grafana/ui';

const helpOptions = [
  { value: 0, label: 'Documentation', href: 'https://grafana.com/docs/grafana/latest' },
  { value: 1, label: 'Tutorials', href: 'https://grafana.com/tutorials' },
  { value: 2, label: 'Community', href: 'https://community.grafana.com' },
  { value: 3, label: 'Public Slack', href: 'http://slack.grafana.com' },
];

const sampleSparkline: FieldSparkline = {
  y: {
    name: 'requests',
    values: [18, 22, 20, 26, 34, 31, 38, 45, 42, 55, 61, 72],
    type: FieldType.number,
    config: {},
    state: {
      range: { min: 18, max: 72, delta: 54 },
    },
  },
};

export const WelcomeBanner = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const helpLinksLabel = t('welcome.welcome-banner.help-links-label', 'Grafana help links');
  const sampleGraphLabel = t('welcome.welcome-banner.sample-graph-aria-label', 'Sample dashboard graph');

  return (
    <div className={styles.container}>
      <div className={styles.copy}>
        <h1 className={styles.title}>
          <Trans i18nKey="welcome.welcome-banner.title">Build your first Grafana dashboard</Trans>
        </h1>
        <p className={styles.subtitle}>
          <Trans i18nKey="welcome.welcome-banner.subtitle">
            Visualize metrics, logs, and traces in minutes with dashboards that bring your data together.
          </Trans>
        </p>
        <div className={styles.actions}>
          <LinkButton href="/dashboard/new" icon="plus" size="lg">
            <Trans i18nKey="welcome.welcome-banner.create-dashboard">Create your first dashboard</Trans>
          </LinkButton>
          <LinkButton href="/dashboard/import" variant="secondary" icon="import" size="lg">
            <Trans i18nKey="welcome.welcome-banner.import-dashboard">Import dashboard</Trans>
          </LinkButton>
        </div>
        <div className={styles.helpLinks} aria-label={helpLinksLabel}>
          {helpOptions.map((option, index) => (
            <TextLink
              key={`${option.label}-${index}`}
              href={`${option.href}?utm_source=grafana_gettingstarted`}
              external
              inline={false}
            >
              {option.label}
            </TextLink>
          ))}
        </div>
      </div>
      <div className={styles.preview} aria-label={sampleGraphLabel}>
        <div className={styles.previewHeader}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="welcome.welcome-banner.sample-graph-label">Sample graph</Trans>
          </Text>
          <Text variant="h4">+24%</Text>
        </div>
        <Sparkline width={360} height={150} theme={theme} sparkline={sampleSparkline} />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      height: '100%',
      minHeight: '280px',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: theme.spacing(4),
      padding: theme.spacing(4),
      background: `linear-gradient(
        135deg,
        ${theme.colors.background.primary} 0%,
        ${theme.colors.background.secondary} 100%
      )`,

      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
        gap: theme.spacing(3),
      },

      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(3, 2),
      },
    }),
    copy: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      maxWidth: '680px',
    }),
    title: css({
      ...theme.typography.h1,
      marginBottom: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        fontSize: theme.typography.h2.fontSize,
      },
    }),
    subtitle: css({
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      maxWidth: '560px',
      marginBottom: theme.spacing(3),
    }),
    actions: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(3),
    }),
    preview: css({
      alignSelf: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '420px',
      minHeight: '220px',
      padding: theme.spacing(3),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.canvas,
      boxShadow: theme.shadows.z2,

      [theme.breakpoints.down('sm')]: {
        width: '100%',
        overflow: 'hidden',
      },
    }),
    previewHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(2),
    }),
    helpLinks: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5, 2),
      textWrap: 'nowrap',

      [theme.breakpoints.down('sm')]: {
        gap: theme.spacing(1),
      },
    }),
  };
};
