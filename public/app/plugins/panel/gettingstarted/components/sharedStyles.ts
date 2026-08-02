import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const cardStyle = (theme: GrafanaTheme2, complete: boolean, isNext = false) => {
  const completeGradient = 'linear-gradient(to right, #5182CC 0%, #245BAF 100%)';
  const darkThemeGradients = complete ? completeGradient : 'linear-gradient(to right, #f05a28 0%, #fbca0a 100%)';
  const lightThemeGradients = complete ? completeGradient : 'linear-gradient(to right, #FBCA0A 0%, #F05A28 100%)';
  const nextGradient = `linear-gradient(to right, ${theme.colors.primary.main} 0%, ${theme.colors.primary.border} 100%)`;

  const borderGradient = isNext ? nextGradient : theme.isDark ? darkThemeGradients : lightThemeGradients;

  return {
    backgroundColor: isNext
      ? theme.colors.emphasize(theme.colors.background.secondary, 0.12)
      : theme.colors.background.secondary,
    marginRight: theme.spacing(3),
    border: isNext ? `2px solid ${theme.colors.primary.border}` : `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    position: 'relative',
    maxHeight: '230px',
    opacity: complete && !isNext ? 0.65 : 1,
    boxShadow: isNext ? theme.shadows.z3 : 'none',
    transform: isNext ? 'translateY(-2px)' : undefined,

    [theme.breakpoints.down('xxl')]: {
      marginRight: theme.spacing(2),
    },
    '&::before': {
      display: 'block',
      content: "' '",
      position: 'absolute',
      left: 0,
      right: 0,
      height: isNext ? '4px' : '2px',
      top: 0,
      backgroundImage: borderGradient,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
    },
  } as const;
};

export const cardContent = css({
  padding: '16px',
});
