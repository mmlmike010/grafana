import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

interface Props {
  stepsDone: number;
  totalStepsToDo: number;
}

export function ProgressStatus({ stepsDone, totalStepsToDo }: Props) {
  const styles = useStyles2(getStyles);

  if (totalStepsToDo === 0) {
    return null;
  }

  const stepsCompleteLabel = t(
    'gettingstarted.progress-status.steps-complete',
    '{{stepsDone}} of {{totalStepsToDo}} complete',
    { stepsDone, totalStepsToDo }
  );

  return (
    <div className={styles.wrapper}>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Text variant="bodySmall" color="secondary" weight="medium">
          {t('gettingstarted.progress-status.your-progress', 'Your progress')}
        </Text>
        <Text variant="bodySmall" weight="medium">
          {stepsCompleteLabel}
        </Text>
      </Stack>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={stepsDone}
        aria-valuemin={0}
        aria-valuemax={totalStepsToDo}
        aria-label={stepsCompleteLabel}
      >
        <div className={styles.filler((stepsDone / totalStepsToDo) * 100)} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2.5),
      padding: theme.spacing(1.5, 2),
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
    track: css({
      height: theme.spacing(1),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.border.weak,
      overflow: 'hidden',
    }),
    filler: (percent: number) =>
      css({
        height: '100%',
        width: `${percent}%`,
        backgroundColor: theme.colors.success.main,
        borderRadius: theme.shape.radius.pill,
        transition: 'width 200ms ease-out',
      }),
  };
}
