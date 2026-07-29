import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

interface CardStyleOptions {
  complete: boolean;
  isNext?: boolean;
}

export const cardStyle = (theme: GrafanaTheme2, complete: boolean | CardStyleOptions, isNext = false) => {
  const options: CardStyleOptions =
    typeof complete === 'boolean' ? { complete, isNext } : { isNext: false, ...complete };

  const completeGradient = 'linear-gradient(to right, #5182CC 0%, #245BAF 100%)';
  const darkThemeGradients = options.complete
    ? completeGradient
    : 'linear-gradient(to right, #f05a28 0%, #fbca0a 100%)';
  const lightThemeGradients = options.complete
    ? completeGradient
    : 'linear-gradient(to right, #FBCA0A 0%, #F05A28 100%)';

  const borderGradient = theme.isDark ? darkThemeGradients : lightThemeGradients;
  const nextBorder = theme.colors.primary.border;

  return {
    backgroundColor: options.isNext ? theme.colors.background.primary : theme.colors.background.secondary,
    marginRight: theme.spacing(3),
    border: options.isNext ? `2px solid ${nextBorder}` : `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    position: 'relative',
    maxHeight: '230px',
    opacity: options.complete && !options.isNext ? 0.72 : 1,
    boxShadow: options.isNext ? theme.shadows.z2 : 'none',
    transition: theme.transitions.create(['border-color', 'box-shadow', 'opacity', 'background-color'], {
      duration: theme.transitions.duration.short,
    }),

    [theme.breakpoints.down('xxl')]: {
      marginRight: theme.spacing(2),
    },
    '&::before': {
      display: 'block',
      content: "' '",
      position: 'absolute',
      left: 0,
      right: 0,
      height: options.isNext ? '3px' : '2px',
      top: 0,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      backgroundImage: options.isNext
        ? `linear-gradient(to right, ${theme.colors.primary.main}, ${theme.colors.primary.shade})`
        : borderGradient,
    },
  } as const;
};

export const cardContent = css({
  padding: '16px',
});
