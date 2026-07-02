package prometheus

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"
)

func TestCheckHealthUsesCurrentInstantQueryTime(t *testing.T) {
	var capturedQueryTime string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/query":
			if r.Method == http.MethodPost {
				if err := r.ParseForm(); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				capturedQueryTime = r.Form.Get("time")
			} else {
				capturedQueryTime = r.URL.Query().Get("time")
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"status": "success",
				"data": {
					"resultType": "scalar",
					"result": [1692969348.331, "2"]
				}
			}`))
		case "/api/v1/status/buildinfo":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"status": "success",
				"data": {
					"version": "1.0",
					"revision": "",
					"branch": "",
					"features": {},
					"buildUser": "",
					"buildDate": "",
					"goVersion": ""
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	service := ProvideService(sdkhttpclient.NewProvider())
	req := &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			PluginID:      "prometheus",
			GrafanaConfig: backend.NewGrafanaCfg(map[string]string{"concurrent_query_count": "10"}),
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				Type:                    "prometheus",
				Name:                    "test-prometheus",
				URL:                     server.URL,
				JSONData:                []byte(`{"httpMethod":"GET"}`),
				DecryptedSecureJSONData: map[string]string{},
			},
		},
	}

	before := time.Now().UTC().Add(-5 * time.Second)
	res, err := service.CheckHealth(context.Background(), req)
	after := time.Now().UTC().Add(5 * time.Second)

	require.NoError(t, err)
	require.Equal(t, backend.HealthStatusOk, res.Status)
	require.Equal(t, "Successfully queried the Prometheus API.", res.Message)
	require.JSONEq(t, `{"application":"Prometheus","features":{"rulerApiEnabled":false}}`, string(res.JSONDetails))

	queryUnixTime, err := strconv.ParseFloat(capturedQueryTime, 64)
	require.NoError(t, err)
	require.NotEqual(t, float64(4), queryUnixTime)
	require.GreaterOrEqual(t, queryUnixTime, float64(before.Unix()))
	require.LessOrEqual(t, queryUnixTime, float64(after.Unix()))
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
