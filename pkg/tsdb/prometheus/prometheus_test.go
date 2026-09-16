package prometheus

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"
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

func TestCheckHealthUsesCurrentTimestamp(t *testing.T) {
	rt := &timeSensitiveHealthCheckRoundTripper{}
	service := ProvideService(newHealthCheckProvider(rt))

	res, err := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: prometheusHealthCheckPluginContext(),
	})

	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, res.Status)
	require.Equal(t, "Successfully queried the Prometheus API.", res.Message)
	require.True(t, rt.sawQuery)
	require.Greater(t, rt.queryTime, float64(time.Now().Add(-time.Minute).Unix()))
}

type timeSensitiveHealthCheckRoundTripper struct {
	sawQuery  bool
	queryTime float64
}

func (rt *timeSensitiveHealthCheckRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	switch req.URL.Path {
	case "/api/v1/query":
		rt.sawQuery = true
		queryTime, err := strconv.ParseFloat(req.URL.Query().Get("time"), 64)
		if err != nil {
			return healthCheckResponse(req, http.StatusBadRequest, prometheusValidationErrorBody), nil
		}
		rt.queryTime = queryTime
		if queryTime < float64(time.Now().Add(-time.Minute).Unix()) {
			return healthCheckResponse(req, http.StatusBadRequest, prometheusValidationErrorBody), nil
		}

		return healthCheckResponse(req, http.StatusOK, `{
			"status": "success",
			"data": {
				"resultType": "scalar",
				"result": [
					1692969348.331,
					"2"
				]
			}
		}`), nil
	case "/api/v1/status/buildinfo":
		return healthCheckResponse(req, http.StatusNotFound, `{}`), nil
	default:
		return healthCheckResponse(req, http.StatusNotFound, `{}`), nil
	}
}

const prometheusValidationErrorBody = `{
	"status": "error",
	"errorType": "bad_data",
	"error": "validation failed"
}`

func healthCheckResponse(req *http.Request, statusCode int, body string) *http.Response {
	return &http.Response{
		Status:     http.StatusText(statusCode),
		StatusCode: statusCode,
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}
}

func newHealthCheckProvider(rt http.RoundTripper) *sdkhttpclient.Provider {
	fn := sdkhttpclient.MiddlewareFunc(func(_ sdkhttpclient.Options, _ http.RoundTripper) http.RoundTripper {
		return rt
	})
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{
		Middlewares: []sdkhttpclient.Middleware{sdkhttpclient.NamedMiddlewareFunc("healthcheck-test", fn)},
	})
}

func prometheusHealthCheckPluginContext() backend.PluginContext {
	return backend.PluginContext{
		OrgID:    1,
		PluginID: "prometheus",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			UID:                     "test-prometheus",
			Type:                    "prometheus",
			Name:                    "test-prometheus",
			URL:                     "http://promurl:9090",
			JSONData:                []byte("{}"),
			DecryptedSecureJSONData: map[string]string{},
			Updated:                 time.Now(),
		},
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
	}
}
