import { render, screen } from 'test/test-utils';

import { WelcomeBanner } from './Welcome';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Sparkline: () => <div data-testid="welcome-sparkline" />,
}));

describe('WelcomeBanner', () => {
  it('renders the hero copy, CTAs, and sample graph', () => {
    render(<WelcomeBanner />);

    expect(screen.getByRole('heading', { name: 'Build your first Grafana dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first dashboard' })).toHaveAttribute(
      'href',
      '/dashboard/new'
    );
    expect(screen.getByRole('link', { name: 'Import dashboard' })).toHaveAttribute('href', '/dashboard/import');
    expect(screen.getByTestId('welcome-sparkline')).toBeInTheDocument();
  });
});
