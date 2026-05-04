import { css } from '@emotion/css';

import { FieldColorModeId, FieldType, type FieldConfig, type FieldSparkline, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  GraphDrawStyle,
  GraphGradientMode,
  LineInterpolation,
  VisibilityMode,
  type GraphFieldConfig,
} from '@grafana/schema';
import { LinkButton, Sparkline, Stack, TextLink, useStyles2, useTheme2 } from '@grafana/ui';

const sampleSparkline: FieldSparkline = {
  x: {
    name: 'time',
    values: [0, 1, 2, 3, 4, 5, 6, 7],
    type: FieldType.number,
    config: {},
  },
  y: {
    name: 'requests',
    values: [12, 19, 15, 28, 24, 35, 31, 46],
    type: FieldType.number,
    config: {},
    state: {
      range: { min: 12, max: 46, delta: 34 },
    },
  },
};

const sampleSparklineConfig: FieldConfig<GraphFieldConfig> = {
  color: {
    mode: FieldColorModeId.Fixed,
    fixedColor: 'semi-dark-green',
  },
  custom: {
    drawStyle: GraphDrawStyle.Line,
    fillOpacity: 18,
    gradientMode: GraphGradientMode.Opacity,
    lineInterpolation: LineInterpolation.Smooth,
    lineWidth: 2,
    pointSize: 0,
    showPoints: VisibilityMode.Never,
  },
};

export const WelcomeBanner = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  return (
    <div className={styles.container}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <Trans i18nKey="welcome.welcome-banner.eyebrow">Welcome to Grafana</Trans>
        </p>
        <h1 className={styles.title}>
          <Trans i18nKey="welcome.welcome-banner.title">Build your first observability dashboard</Trans>
        </h1>
        <p className={styles.subtitle}>
          <Trans i18nKey="welcome.welcome-banner.subtitle">
            Turn metrics, logs, and traces into dashboards your team can use right away.
          </Trans>
        </p>
        <Stack gap={1.5} wrap="wrap">
          <LinkButton href="dashboard/new" icon="plus" size="lg">
            <Trans i18nKey="welcome.welcome-banner.create-dashboard">Create your first dashboard</Trans>
          </LinkButton>
          <LinkButton href="dashboard/import" icon="download-alt" size="lg" variant="secondary">
            <Trans i18nKey="welcome.welcome-banner.import-dashboard">Import dashboard</Trans>
          </LinkButton>
        </Stack>
      </div>
      <div className={styles.preview}>
        <div className={styles.previewHeader}>
          <span>
            <Trans i18nKey="welcome.welcome-banner.sample-graph-title">Live sample</Trans>
          </span>
          <TextLink href="https://grafana.com/docs/grafana/latest/dashboards/" external>
            <Trans i18nKey="welcome.welcome-banner.learn-dashboards">Learn dashboards</Trans>
          </TextLink>
        </div>
        <div
          role="img"
          aria-label={t('welcome.welcome-banner.sample-graph-aria-label', 'Sample dashboard metric graph')}
        >
          <Sparkline
            width={320}
            height={112}
            sparkline={sampleSparkline}
            config={sampleSparklineConfig}
            theme={theme}
          />
        </div>
        <div className={styles.previewFooter}>
          <span className={styles.previewValue}>
            <Trans i18nKey="welcome.welcome-banner.sample-graph-value">46 req/s</Trans>
          </span>
          <span className={styles.previewTrend}>
            <Trans i18nKey="welcome.welcome-banner.sample-graph-trend">+28% over last hour</Trans>
          </span>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      height: '100%',
      minHeight: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(4),
      padding: theme.spacing(3, 4),
      background: `linear-gradient(135deg, ${theme.colors.background.primary} 0%, ${theme.colors.background.secondary} 100%)`,

      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: theme.spacing(2),
      },

      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
    }),
    copy: css({
      maxWidth: 620,
    }),
    eyebrow: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      letterSpacing: '0.08em',
      lineHeight: theme.typography.bodySmall.lineHeight,
      marginBottom: theme.spacing(1),
      textTransform: 'uppercase',
    }),
    title: css({
      fontSize: theme.typography.h1.fontSize,
      lineHeight: 1.05,
      marginBottom: theme.spacing(2),

      [theme.breakpoints.down('lg')]: {
        fontSize: theme.typography.h2.fontSize,
      },

      [theme.breakpoints.down('sm')]: {
        fontSize: theme.typography.h3.fontSize,
      },
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: 1.4,
      marginBottom: theme.spacing(3),
      maxWidth: 560,
    }),
    preview: css({
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      minWidth: 360,
      padding: theme.spacing(2),

      [theme.breakpoints.down('lg')]: {
        minWidth: 0,
        width: '100%',
      },
    }),
    previewHeader: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
    }),
    previewFooter: css({
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: theme.spacing(1),
    }),
    previewValue: css({
      fontSize: theme.typography.h2.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    previewTrend: css({
      color: theme.colors.success.text,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
