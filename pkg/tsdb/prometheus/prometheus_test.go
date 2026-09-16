package prometheus

import (
	"context"
	"io"
	"net/http"
	"net/url"
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

func TestCheckHealthUsesCurrentTime(t *testing.T) {
	rt := &healthCheckRoundTripper{}
	s := ProvideService(newHealthCheckProvider(rt))

	start := time.Now().Add(-time.Minute).Unix()
	res, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: prometheusPluginContext(),
	})
	end := time.Now().Add(time.Minute).Unix()

	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, res.Status)
	require.JSONEq(t, `{"application":"Mimir","features":{"rulerApiEnabled":true}}`, string(res.JSONDetails))
	require.Equal(t, "1+1", rt.query.Get("query"))

	queryTime, err := strconv.ParseFloat(rt.query.Get("time"), 64)
	require.NoError(t, err)
	require.GreaterOrEqual(t, int64(queryTime), start)
	require.LessOrEqual(t, int64(queryTime), end)
	require.NotEqual(t, "4", rt.query.Get("time"))
}

type healthCheckRoundTripper struct {
	query url.Values
}

func (rt *healthCheckRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	switch req.URL.Path {
	case "/api/v1/query":
		rt.query = requestValues(req)
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
					"version": "2.0",
					"features": {"ruler_config": "true"}
				}
			}`)),
			Request: req,
		}, nil
	default:
		return &http.Response{
			Status:     "404 Not Found",
			StatusCode: http.StatusNotFound,
			Body:       http.NoBody,
			Request:    req,
		}, nil
	}
}

func newHealthCheckProvider(rt *healthCheckRoundTripper) *sdkhttpclient.Provider {
	fn := sdkhttpclient.MiddlewareFunc(func(o sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return rt
	})
	mid := sdkhttpclient.NamedMiddlewareFunc("mock", fn)
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: []sdkhttpclient.Middleware{mid}})
}

func requestValues(req *http.Request) url.Values {
	if req.Method != http.MethodPost {
		return req.URL.Query()
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return url.Values{}
	}
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return url.Values{}
	}
	return values
}

func prometheusPluginContext() backend.PluginContext {
	return backend.PluginContext{
		PluginID: "prometheus",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			Type:                    "prometheus",
			Name:                    "test-prometheus",
			URL:                     "http://promurl:9090",
			JSONData:                []byte("{}"),
			DecryptedSecureJSONData: map[string]string{},
		},
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
	}
}
