import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

interface Props {
  heading: string;
  subheading: string;
  stepsDone: number;
  totalSteps: number;
}

export function ProgressHeader({ heading, subheading, stepsDone, totalSteps }: Props) {
  const styles = useStyles2(getStyles);
  const progressPercent = totalSteps > 0 ? (stepsDone / totalSteps) * 100 : 0;

  return (
    <div className={styles.header}>
      <Stack direction="column" gap={1}>
        <Text element="h2" variant="h4">
          {heading}
        </Text>
        <Text color="secondary" variant="bodySmall">
          {subheading}
        </Text>
        <Stack direction="row" gap={1.5} alignItems="center" wrap="wrap">
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuenow={stepsDone}
            aria-valuemax={totalSteps}
            aria-label={t('gettingstarted.progress-header.aria-label-setup-progress', 'Setup progress')}
          >
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <span className={styles.progressLabel}>
            <Trans i18nKey="gettingstarted.progress-header.steps-complete" values={{ stepsDone, totalSteps }}>
              <Text color="success" variant="bodySmall" weight="medium">
                {'{{stepsDone}}'}
              </Text>{' '}
              of {{ totalSteps }} complete
            </Trans>
          </span>
        </Stack>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    width: '100%',
    marginBottom: theme.spacing(2.5),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
  progressTrack: css({
    flex: '1 1 160px',
    maxWidth: 280,
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.border.weak,
    overflow: 'hidden',
  }),
  progressFill: css({
    height: '100%',
    backgroundColor: theme.colors.success.main,
    borderRadius: theme.shape.radius.pill,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'width 200ms ease-out',
    },
  }),
  progressLabel: css({
    whiteSpace: 'nowrap',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
});
