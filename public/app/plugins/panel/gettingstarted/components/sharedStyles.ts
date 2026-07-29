import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export type CardVisualState = 'complete' | 'next' | 'pending';

export const cardStyle = (theme: GrafanaTheme2, state: CardVisualState) => {
  const completeGradient = 'linear-gradient(to right, #5182CC 0%, #245BAF 100%)';
  const nextGradient = theme.isDark
    ? 'linear-gradient(to right, #f05a28 0%, #fbca0a 100%)'
    : 'linear-gradient(to right, #FBCA0A 0%, #F05A28 100%)';
  const pendingGradient = theme.isDark
    ? 'linear-gradient(to right, rgba(240, 90, 40, 0.45) 0%, rgba(251, 202, 10, 0.45) 100%)'
    : 'linear-gradient(to right, rgba(251, 202, 10, 0.55) 0%, rgba(240, 90, 40, 0.55) 100%)';

  const borderGradient = state === 'complete' ? completeGradient : state === 'next' ? nextGradient : pendingGradient;

  return {
    backgroundColor:
      state === 'next' ? theme.colors.emphasize(theme.colors.background.secondary, 0.08) : theme.colors.background.secondary,
    marginRight: theme.spacing(3),
    border:
      state === 'next'
        ? `1px solid ${theme.colors.warning.border}`
        : state === 'complete'
          ? `1px solid ${theme.colors.border.weak}`
          : `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    position: 'relative' as const,
    maxHeight: '230px',
    opacity: state === 'complete' ? 0.72 : 1,
    boxShadow: state === 'next' ? theme.shadows.z2 : 'none',
    outline: state === 'next' ? `2px solid ${theme.colors.warning.main}` : 'none',
    outlineOffset: state === 'next' ? '2px' : undefined,

    [theme.breakpoints.down('xxl')]: {
      marginRight: theme.spacing(2),
    },
    '&::before': {
      display: 'block',
      content: "' '",
      position: 'absolute',
      left: 0,
      right: 0,
      height: state === 'next' ? '4px' : '2px',
      top: 0,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      backgroundImage: borderGradient,
    },
  } as const;
};

export const cardContent = css({
  padding: '16px',
});
