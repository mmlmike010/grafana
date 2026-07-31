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
	"github.com/stretchr/testify/assert"
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

type capturingRoundTripper struct {
	lastReq *http.Request
}

func (rt *capturingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.lastReq = req.Clone(req.Context())
	if req.URL != nil {
		rt.lastReq.URL = req.URL
	}
	return &http.Response{
		Status:     "200",
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: io.NopCloser(strings.NewReader(`{
			"status": "success",
			"data": {
				"resultType": "scalar",
				"result": [1692969348.331, "2"]
			}
		}`)),
		Request: req,
	}, nil
}

func TestCheckHealthUsesCurrentTime(t *testing.T) {
	rt := &capturingRoundTripper{}
	provider := sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{
		Middlewares: []sdkhttpclient.Middleware{
			sdkhttpclient.NamedMiddlewareFunc("capture", func(_ sdkhttpclient.Options, _ http.RoundTripper) http.RoundTripper {
				return rt
			}),
		},
	})

	svc := ProvideService(provider)
	before := time.Now().UTC().Add(-time.Minute)

	res, err := svc.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			PluginID: "prometheus",
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				Type:                    "prometheus",
				Name:                    "test-prometheus",
				URL:                     "http://prom.example:9090",
				JSONData:                []byte(`{}`),
				DecryptedSecureJSONData: map[string]string{},
			},
			GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	require.NotNil(t, rt.lastReq)
	require.NotNil(t, rt.lastReq.URL)

	query := rt.lastReq.URL.Query()
	timeParam := query.Get("time")
	require.NotEmpty(t, timeParam, "health check must send a time query parameter")
	assert.NotEqual(t, "4", timeParam, "health check must not use the historical promlib Unix(4) timestamp")

	parsed, err := parsePromTime(timeParam)
	require.NoError(t, err)
	assert.True(t, !parsed.Before(before), "expected health-check time %v to be at/after %v", parsed, before)
	assert.True(t, !parsed.After(time.Now().UTC().Add(time.Minute)), "expected health-check time %v to be near now", parsed)
}

func parsePromTime(raw string) (time.Time, error) {
	if secs, err := strconv.ParseFloat(raw, 64); err == nil {
		return time.Unix(0, int64(secs*float64(time.Second))).UTC(), nil
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC(), nil
	}
	// Fall back to URL-unescaped values that may still be floats.
	unescaped, err := url.QueryUnescape(raw)
	if err != nil {
		return time.Time{}, err
	}
	secs, err := strconv.ParseFloat(unescaped, 64)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, int64(secs*float64(time.Second))).UTC(), nil
}
