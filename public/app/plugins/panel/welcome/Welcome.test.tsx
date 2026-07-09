import { render, screen } from 'test/test-utils';

import { WelcomeBanner } from './Welcome';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Sparkline: () => <div data-testid="welcome-sample-sparkline" />,
}));

describe('WelcomeBanner', () => {
  it('renders the hero CTA and sample graph', () => {
    render(<WelcomeBanner />);

    expect(screen.getByRole('heading', { name: 'Build your first observability dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first dashboard' })).toHaveAttribute('href', 'dashboard/new');
    expect(screen.getByRole('link', { name: 'Import dashboard' })).toHaveAttribute('href', 'dashboard/import');
    expect(screen.getByRole('link', { name: 'Learn dashboards' })).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana/latest/dashboards/'
    );
    expect(screen.getByRole('img', { name: 'Sample dashboard metric graph' })).toBeInTheDocument();
    expect(screen.getByTestId('welcome-sample-sparkline')).toBeInTheDocument();
  });
});
