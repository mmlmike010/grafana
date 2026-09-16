package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"

	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib"
	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/azureauth"
)

const healthCheckRefID = "__healthcheck__"

type Service struct {
	lib *promlib.Service
}

func ProvideService(httpClientProvider *sdkhttpclient.Provider) *Service {
	plog := backend.NewLoggerWith("logger", "tsdb.prometheus")
	plog.Debug("Initializing")
	return &Service{
		lib: promlib.NewService(httpClientProvider, plog, extendClientOpts),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return s.lib.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.lib.CallResource(ctx, req, sender)
}

func (s *Service) GetBuildInfo(ctx context.Context, req promlib.BuildInfoRequest) (*promlib.BuildInfoResponse, error) {
	return s.lib.GetBuildInfo(ctx, req)
}

func (s *Service) GetHeuristics(ctx context.Context, req promlib.HeuristicsRequest) (*promlib.Heuristics, error) {
	return s.lib.GetHeuristics(ctx, req)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	hc, err := s.checkHealth(ctx, req)
	if err != nil {
		return nil, err
	}

	heuristics, err := s.lib.GetHeuristics(ctx, promlib.HeuristicsRequest{PluginContext: req.PluginContext})
	if err == nil {
		jsonDetails, err := json.Marshal(heuristics)
		if err == nil {
			hc.JSONDetails = jsonDetails
		}
	}

	return hc, nil
}

func (s *Service) checkHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	qm := models.QueryModel{
		UtcOffsetSec: 0,
		CommonQueryProperties: sdkapi.CommonQueryProperties{
			RefID: healthCheckRefID,
		},
		PrometheusQueryProperties: models.PrometheusQueryProperties{
			Expr:    "1+1",
			Instant: true,
		},
	}
	b, err := json.Marshal(&qm)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	query := backend.DataQuery{
		RefID: healthCheckRefID,
		TimeRange: backend.TimeRange{
			From: now.Add(-3 * time.Second),
			To:   now,
		},
		JSON: b,
	}
	resp, err := s.lib.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries:       []backend.DataQuery{query},
	})
	if err != nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.", err), nil
	}

	if resp == nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.",
			errors.New("missing query response")), nil
	}

	dataResponse, ok := resp.Responses[healthCheckRefID]
	if !ok {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.",
			errors.New("missing health check response")), nil
	}

	if dataResponse.Error != nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.",
			errors.New(dataResponse.Error.Error())), nil
	}

	return getHealthCheckMessage("Successfully queried the Prometheus API.", nil), nil
}

func getHealthCheckMessage(message string, err error) *backend.CheckHealthResult {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: message,
		}
	}

	errorMessage := fmt.Sprintf("%s - %s", err.Error(), message)
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}
}

func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	return s.lib.ValidateAdmission(ctx, req)
}

func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	return s.lib.MutateAdmission(ctx, req)
}
func (s *Service) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return s.lib.ConvertObjects(ctx, req)
}

func extendClientOpts(ctx context.Context, settings backend.DataSourceInstanceSettings, clientOpts *sdkhttpclient.Options, plog log.Logger) error {
	// Set SigV4 service namespace
	if clientOpts.SigV4 != nil {
		clientOpts.SigV4.Service = "aps"
	}

	azureSettings, err := azsettings.ReadSettings(ctx)
	if err != nil {
		return fmt.Errorf("failed to read Azure settings from Grafana: %v", err)
	}

	audienceOverride := backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("prometheusAzureOverrideAudience")

	// Set Azure authentication
	if azureSettings.AzureAuthEnabled {
		err = azureauth.ConfigureAzureAuthentication(settings, azureSettings, clientOpts, audienceOverride, plog)
		if err != nil {
			return fmt.Errorf("error configuring Azure auth: %v", err)
		}
	}

	return nil
}
