import { render, screen } from 'test/test-utils';

import { getPanelProps } from '../test-utils';

import { SAMPLE_HERO_SPARKLINE_VALUES, WelcomeBanner } from './Welcome';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    Sparkline: () => <div data-testid="welcome-sparkline-stub" />,
  };
});

describe('WelcomeBanner', () => {
  it('renders hero copy and navigation links', async () => {
    const props = getPanelProps({}, { width: 960, height: 240 });
    render(<WelcomeBanner {...props} />);

    expect(await screen.findByTestId('welcome-hero-title')).toHaveTextContent('Welcome to Grafana');
    expect(screen.getByTestId('welcome-hero-create-dashboard')).toHaveAttribute('href', '/dashboard/new');
    expect(screen.getByTestId('welcome-hero-import-dashboard')).toHaveAttribute('href', '/dashboard/import');
    expect(screen.getByTestId('welcome-sparkline-stub')).toBeInTheDocument();
  });

  it('ships a deterministic sample series for demos', () => {
    expect(SAMPLE_HERO_SPARKLINE_VALUES.length).toBeGreaterThan(12);
    expect(SAMPLE_HERO_SPARKLINE_VALUES.every((v) => typeof v === 'number')).toBe(true);
  });
});
