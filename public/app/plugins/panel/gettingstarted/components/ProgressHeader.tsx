import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

interface Props {
  stepsDone: number;
  totalSteps: number;
}

export function ProgressHeader({ stepsDone, totalSteps }: Props) {
  const styles = useStyles2(getStyles);

  if (totalSteps === 0) {
    return null;
  }

  const percent = (stepsDone / totalSteps) * 100;
  const completeLabel = t(
    'gettingstarted.progress-header.steps-complete',
    '{{stepsDone}} of {{totalSteps}} complete',
    { stepsDone, totalSteps }
  );

  return (
    <div className={styles.container}>
      <div className={styles.labelRow}>
        <Text variant="bodySmall" weight="medium" color="secondary">
          {t('gettingstarted.progress-header.your-progress', 'Your progress')}
        </Text>
        <Text variant="bodySmall" weight="medium">
          {completeLabel}
        </Text>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={stepsDone}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={completeLabel}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2.5),
      width: '100%',
    }),
    labelRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
    track: css({
      height: theme.spacing(1),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.border.weak,
      overflow: 'hidden',
    }),
    fill: css({
      height: '100%',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.success.main,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'width 200ms ease-out',
      },
    }),
  };
}
