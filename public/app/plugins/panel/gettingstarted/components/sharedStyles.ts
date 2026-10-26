import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const cardStyle = (theme: GrafanaTheme2, complete: boolean, isNext: boolean) => {
  let accent = theme.colors.border.medium;
  if (complete) {
    accent = theme.colors.success.main;
  } else if (isNext) {
    accent = theme.colors.gradients.brandHorizontal;
  }

  return {
    backgroundColor: isNext ? theme.colors.background.elevated : theme.colors.background.secondary,
    border: `1px solid ${isNext ? theme.colors.primary.border : theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: isNext ? theme.shadows.z2 : 'none',
    color: complete ? theme.colors.text.secondary : theme.colors.text.primary,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    maxHeight: '230px',

    '&::before': {
      display: 'block',
      content: "' '",
      position: 'absolute',
      left: 0,
      right: 0,
      height: isNext ? '3px' : '2px',
      top: 0,
      background: accent,
    },
  } as const;
};

export const cardContent = css({
  padding: '16px',
});

export const getCardHeaderStyles = (theme: GrafanaTheme2, complete: boolean) => ({
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    minHeight: theme.spacing(3),
  }),
  status: css({
    ...theme.typography.bodySmall,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    textTransform: 'uppercase',
    fontWeight: theme.typography.fontWeightMedium,
    color: complete ? theme.colors.success.text : theme.colors.text.secondary,
  }),
});
