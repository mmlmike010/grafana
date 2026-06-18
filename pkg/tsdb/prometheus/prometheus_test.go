package prometheus

import (
	"context"
	"io"
	"net/http"
	"net/url"
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

type healthCheckRoundTripper struct {
	mu        sync.Mutex
	queryTime string
}

func (rt *healthCheckRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	body := ""
	if req.Body != nil {
		bodyBytes, err := io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		body = string(bodyBytes)
	}

	switch req.URL.Path {
	case "/api/v1/query":
		values, err := url.ParseQuery(body)
		if err != nil {
			return nil, err
		}
		rt.mu.Lock()
		rt.queryTime = values.Get("time")
		rt.mu.Unlock()

		if rt.queryTime == "4" {
			return &http.Response{
				Status:     "400 Bad Request",
				StatusCode: http.StatusBadRequest,
				Body:       io.NopCloser(strings.NewReader(`{"status":"error","error":"validation failed"}`)),
				Request:    req,
			}, nil
		}

		return &http.Response{
			Status:     "200 OK",
			StatusCode: http.StatusOK,
			Body: io.NopCloser(strings.NewReader(`{
				"status": "success",
				"data": {
					"resultType": "scalar",
					"result": [1692969348.331, "2"]
				}
			}`)),
			Request: req,
		}, nil
	case "/api/v1/status/buildinfo":
		return &http.Response{
			Status:     "200 OK",
			StatusCode: http.StatusOK,
			Body: io.NopCloser(strings.NewReader(`{
				"status": "success",
				"data": {
					"version": "2.0.0",
					"features": {}
				}
			}`)),
			Request: req,
		}, nil
	default:
		return &http.Response{
			Status:     "404 Not Found",
			StatusCode: http.StatusNotFound,
			Body:       io.NopCloser(strings.NewReader("not found")),
			Request:    req,
		}, nil
	}
}

func newHealthCheckProvider(rt *healthCheckRoundTripper) *sdkhttpclient.Provider {
	fn := sdkhttpclient.MiddlewareFunc(func(o sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return rt
	})
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{
		Middlewares: []sdkhttpclient.Middleware{sdkhttpclient.NamedMiddlewareFunc("mock", fn)},
	})
}

func TestCheckHealthUsesCurrentInstantQueryTime(t *testing.T) {
	rt := &healthCheckRoundTripper{}
	service := ProvideService(newHealthCheckProvider(rt))
	startedAt := time.Now().Add(-5 * time.Second)

	result, err := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			PluginID:      "prometheus",
			GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				ID:                      1,
				UID:                     "prometheus",
				Type:                    "prometheus",
				Name:                    "Prometheus",
				URL:                     "http://prometheus.example",
				JSONData:                []byte(`{"httpMethod":"POST"}`),
				DecryptedSecureJSONData: map[string]string{},
			},
		},
	})

	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, result.Status)
	require.JSONEq(t, `{"application":"Prometheus","features":{"rulerApiEnabled":false}}`, string(result.JSONDetails))

	rt.mu.Lock()
	queryTime := rt.queryTime
	rt.mu.Unlock()
	require.NotEmpty(t, queryTime)
	require.NotEqual(t, "4", queryTime)

	queryTimestamp, err := strconv.ParseFloat(queryTime, 64)
	require.NoError(t, err)
	require.GreaterOrEqual(t, queryTimestamp, float64(startedAt.Unix()))
	require.LessOrEqual(t, queryTimestamp, float64(time.Now().Add(5*time.Second).Unix()))
}

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
