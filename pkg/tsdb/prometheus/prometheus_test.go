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
	var queryTime string

	provider := newPrometheusHTTPProvider(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.Path {
		case "/api/v1/query":
			bodyBytes, err := io.ReadAll(req.Body)
			require.NoError(t, err)

			form, err := url.ParseQuery(string(bodyBytes))
			require.NoError(t, err)

			queryTime = form.Get("time")
			require.Equal(t, "1+1", form.Get("query"))

			return newPrometheusResponse(req, http.StatusOK, `{
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
			return newPrometheusResponse(req, http.StatusOK, `{
				"status": "success",
				"data": {
					"version": "2.47.0",
					"revision": "",
					"branch": "",
					"features": {
						"ruler": "true"
					},
					"buildUser": "",
					"buildDate": "",
					"goVersion": ""
				}
			}`), nil
		default:
			return newPrometheusResponse(req, http.StatusNotFound, ""), nil
		}
	}))
	service := ProvideService(provider)

	cfg := backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"})
	ctx := backend.WithGrafanaConfig(context.Background(), cfg)
	started := time.Now().Add(-time.Minute)

	res, err := service.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: getPrometheusPluginContext(cfg),
	})
	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, res.Status)
	require.JSONEq(t, `{"application":"Mimir","features":{"rulerApiEnabled":true}}`, string(res.JSONDetails))

	require.NotEmpty(t, queryTime)
	queryUnix, err := strconv.ParseFloat(queryTime, 64)
	require.NoError(t, err)
	require.GreaterOrEqual(t, queryUnix, float64(started.Unix()))
	require.LessOrEqual(t, queryUnix, float64(time.Now().Add(time.Minute).Unix()))
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newPrometheusHTTPProvider(rt http.RoundTripper) *sdkhttpclient.Provider {
	fn := sdkhttpclient.MiddlewareFunc(func(_ sdkhttpclient.Options, _ http.RoundTripper) http.RoundTripper {
		return rt
	})
	middleware := sdkhttpclient.NamedMiddlewareFunc("prometheus-test", fn)
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: []sdkhttpclient.Middleware{middleware}})
}

func newPrometheusResponse(req *http.Request, statusCode int, body string) *http.Response {
	return &http.Response{
		Status:        http.StatusText(statusCode),
		StatusCode:    statusCode,
		Header:        http.Header{},
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
		Request:       req,
	}
}

func getPrometheusPluginContext(cfg *backend.GrafanaCfg) backend.PluginContext {
	return backend.PluginContext{
		OrgID:         1,
		PluginID:      "prometheus",
		GrafanaConfig: cfg,
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID:                      1,
			UID:                     "prom-prod-us-east-1",
			Type:                    "prometheus",
			Name:                    "prom-prod-us-east-1",
			URL:                     "http://prometheus.example",
			JSONData:                []byte("{}"),
			DecryptedSecureJSONData: map[string]string{},
		},
	}
}
