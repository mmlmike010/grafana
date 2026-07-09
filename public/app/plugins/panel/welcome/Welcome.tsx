import { useMemo } from 'react';

import { css } from '@emotion/css';

import { type FieldSparkline, FieldType, type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { GraphDrawStyle, GraphGradientMode } from '@grafana/schema';
import { LinkButton, Sparkline, TextLink, useStyles2, useTheme2 } from '@grafana/ui';

const helpOptions = [
  { label: 'Documentation', href: 'https://grafana.com/docs/grafana/latest' },
  { label: 'Tutorials', href: 'https://grafana.com/tutorials' },
  { label: 'Community', href: 'https://community.grafana.com' },
  { label: 'Public Slack', href: 'http://slack.grafana.com' },
];

/** Stable demo-series so the hero sparkline is deterministic across renders. */
export const SAMPLE_HERO_SPARKLINE_VALUES = [
  38, 40, 39, 44, 48, 52, 54, 58, 61, 64, 66, 65, 68, 71, 70, 67, 64, 66, 69, 72, 75, 78, 80, 79, 77, 74, 76, 78, 82, 84,
];

export function WelcomeBanner(props: PanelProps<{}>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { width: panelWidth, height: panelHeight } = props;

  const sparklineConfig = useMemo(
    () => ({
      width: Math.round(Math.min(480, Math.max(220, panelWidth * 0.38))),
      height: Math.round(Math.min(200, Math.max(92, panelHeight * 0.55))),
      data: buildSampleSparkline(),
    }),
    [panelWidth, panelHeight]
  );

  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <div className={styles.copy}>
          <h1 className={styles.title} data-testid="welcome-hero-title">
            <Trans i18nKey="welcome.hero.title">Welcome to Grafana</Trans>
          </h1>
          <p className={styles.subtitle}>
            <Trans i18nKey="welcome.hero.subtitle">
              Build dashboards from your observability data, or import a starter to explore sample metrics quickly.
            </Trans>
          </p>
          <div className={styles.ctaRow}>
            <LinkButton
              href="/dashboard/new"
              variant="primary"
              size="lg"
              data-testid="welcome-hero-create-dashboard"
            >
              {t('welcome.hero.primary-cta', 'Create your first dashboard')}
            </LinkButton>
            <LinkButton href="/dashboard/import" fill="outline" size="lg" data-testid="welcome-hero-import-dashboard">
              {t('welcome.hero.secondary-cta', 'Import dashboard')}
            </LinkButton>
          </div>
          <div className={styles.help}>
            <span className={styles.helpLabel}>
              <Trans i18nKey="welcome.hero.need-help-label">Need help?</Trans>
            </span>
            <div className={styles.helpLinks}>
              {helpOptions.map(({ label, href }) => (
                <TextLink key={label} href={`${href}?utm_source=grafana_home_hero`} external inline={false}>
                  {label}
                </TextLink>
              ))}
            </div>
          </div>
        </div>
        <div
          className={styles.sparklineWrap}
          data-testid="welcome-hero-sparkline"
          aria-label={t('welcome.hero.sample-graph-label', 'Sample metrics trend')}
        >
          <Sparkline
            theme={theme}
            width={sparklineConfig.width}
            height={sparklineConfig.height}
            sparkline={sparklineConfig.data}
            config={{
              custom: {
                drawStyle: GraphDrawStyle.Line,
                lineWidth: 2,
                fillOpacity: 12,
                gradientMode: GraphGradientMode.Opacity,
              },
              color: {
                mode: 'fixed',
                fixedColor: theme.colors.primary.main,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function buildSampleSparkline(): FieldSparkline {
  return {
    y: {
      name: 'sample',
      type: FieldType.number,
      values: SAMPLE_HERO_SPARKLINE_VALUES,
      config: {},
    },
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: theme.spacing(18),
      padding: theme.spacing(2, 3),
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1.5, 1.5),
      },
    }),
    main: css({
      display: 'flex',
      flex: 1,
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: theme.spacing(3),

      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column-reverse',
      },
    }),
    copy: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      flex: '1 1 0',
      minWidth: 0,
    }),
    title: css({
      marginBottom: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
      [theme.breakpoints.down('sm')]: {
        fontSize: theme.typography.h2.fontSize,
      },
    }),
    subtitle: css({
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      maxWidth: 520,
      marginBottom: theme.spacing(2),
    }),
    ctaRow: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    }),
    help: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: theme.spacing(1, 2),
    }),
    helpLabel: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    helpLinks: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        gap: theme.spacing(1),
      },
    }),
    sparklineWrap: css({
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',

      [theme.breakpoints.down('lg')]: {
        justifyContent: 'flex-start',
      },
    }),
  };
};
