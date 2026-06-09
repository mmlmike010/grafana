package prometheus

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"
)

func TestExtendClientOpts(t *testing.T) {
	t.Run("add azure credentials if configured", func(t *testing.T) {
		cfg := backend.NewGrafanaCfg(map[string]string{
			azsettings.AzureCloud:       azsettings.AzurePublic,
			azsettings.AzureAuthEnabled: "true",
		})
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"azureCredentials": {
					"authType": "msi"
				}
			}`),
			DecryptedSecureJSONData: map[string]string{},
		}
		ctx := backend.WithGrafanaConfig(context.Background(), cfg)
		opts := &sdkhttpclient.Options{}
		err := extendClientOpts(ctx, settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, 1, len(opts.Middlewares))
	})

	t.Run("add sigV4 auth if opts has SigV4 configured", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled:        false,
			BasicAuthUser:           "",
			JSONData:                []byte(""),
			DecryptedSecureJSONData: map[string]string{},
		}
		opts := &sdkhttpclient.Options{
			SigV4: &sdkhttpclient.SigV4Config{
				AuthType:  "test",
				AccessKey: "accesskey",
				SecretKey: "secretkey",
			},
		}
		err := extendClientOpts(context.Background(), settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, "aps", opts.SigV4.Service)
	})
}

func TestCheckHealthUsesCurrentTime(t *testing.T) {
	rt := &healthCheckRoundTripper{}
	svc := ProvideService(newHealthCheckHTTPProvider(rt))

	before := time.Now().UTC().Add(-time.Second)
	res, err := svc.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: healthCheckPluginContext(),
	})
	after := time.Now().UTC().Add(time.Second)

	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, res.Status)

	requestedTimes := rt.requestedTimes()
	require.Len(t, requestedTimes, 1)
	require.True(t, requestedTimes[0].After(before), "health check time %s must be after %s", requestedTimes[0], before)
	require.True(t, requestedTimes[0].Before(after), "health check time %s must be before %s", requestedTimes[0], after)
	require.NotEqual(t, time.Unix(4, 0).UTC(), requestedTimes[0])
}

type healthCheckRoundTripper struct {
	mu    sync.Mutex
	times []time.Time
}

func (rt *healthCheckRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	switch req.URL.Path {
	case "/api/v1/query":
		queryTime, err := parsePrometheusTime(req.URL.Query().Get("time"))
		if err != nil {
			return nil, err
		}

		rt.mu.Lock()
		rt.times = append(rt.times, queryTime)
		rt.mu.Unlock()

		return healthCheckResponse(http.StatusOK, `{"status":"success","data":{"resultType":"scalar","result":[1692969348.331,"2"]}}`, req), nil
	default:
		return healthCheckResponse(http.StatusNotFound, "not found", req), nil
	}
}

func (rt *healthCheckRoundTripper) requestedTimes() []time.Time {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	times := make([]time.Time, len(rt.times))
	copy(times, rt.times)
	return times
}

func newHealthCheckHTTPProvider(rt http.RoundTripper) *sdkhttpclient.Provider {
	fn := sdkhttpclient.MiddlewareFunc(func(_ sdkhttpclient.Options, _ http.RoundTripper) http.RoundTripper {
		return rt
	})

	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{
		Middlewares: []sdkhttpclient.Middleware{
			sdkhttpclient.NamedMiddlewareFunc("mock", fn),
		},
	})
}

func healthCheckPluginContext() backend.PluginContext {
	return backend.PluginContext{
		PluginID: "prometheus",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			Type:                    "prometheus",
			Name:                    "test-prometheus",
			URL:                     "http://prometheus.example",
			JSONData:                []byte("{}"),
			DecryptedSecureJSONData: map[string]string{},
		},
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
	}
}

func healthCheckResponse(statusCode int, body string, req *http.Request) *http.Response {
	return &http.Response{
		Status:        fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode)),
		StatusCode:    statusCode,
		Header:        http.Header{},
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
		Request:       req,
	}
}

func parsePrometheusTime(value string) (time.Time, error) {
	timestamp, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return time.Time{}, err
	}

	seconds, fraction := math.Modf(timestamp)
	return time.Unix(int64(seconds), int64(fraction*1e9)).UTC(), nil
}
