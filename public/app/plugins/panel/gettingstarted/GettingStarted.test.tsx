import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { getPanelProps } from '../test-utils';

import { GettingStarted } from './GettingStarted';

const mockMetricsDataSource = mockDataSource(undefined, { metrics: true });

setBackendSrv(backendSrv);
setupDataSources(mockMetricsDataSource);
setupMockServer();

describe.each([
  // App platform APIs
  true,
  // Legacy APIs
  false,
])('GettingStarted - app platform APIs: %s', (featureTogglesEnabled) => {
  testWithFeatureToggles({ enable: featureTogglesEnabled ? ['unifiedStorageSearchUI'] : [] });

  it('renders getting started steps', async () => {
    const props = getPanelProps({});
    render(<GettingStarted {...props} />);

    expect(await screen.findByRole('progressbar', { name: /setup progress/i })).toBeInTheDocument();
    expect(await screen.findByText(/of 3 complete/i)).toBeInTheDocument();

    const headings = (await screen.findAllByRole('heading')).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Welcome to Grafana',
      'Basic',
      'Grafana fundamentals',
      'Add your first data source',
      'Create your first dashboard',
    ]);
    const dataSourceStepLink = await screen.findByRole('link', { name: /add your first data source/i });
    expect(dataSourceStepLink).toHaveTextContent(/complete/i);

    const dashboardStepLink = await screen.findByRole('link', { name: /create your first dashboard/i });
    expect(dashboardStepLink).toHaveTextContent(/complete/i);

    expect(screen.getByTestId('getting-started-next-step')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-next-step')).toHaveTextContent(/grafana fundamentals/i);
  });

  it('allows navigating between steps', async () => {
    const props = getPanelProps({});
    const { user } = render(<GettingStarted {...props} />);

    await user.click(await screen.findByRole('button', { name: /to advanced tutorials/i }));
    expect(await screen.findByRole('heading', { name: /setup complete!/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /advanced/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /to basic tutorials/i }));
    expect(await screen.findByRole('heading', { name: /welcome to grafana/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /basic/i })).toBeInTheDocument();
  });
});
