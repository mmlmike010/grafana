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

// CheckHealth overrides promlib's health check, which evaluates the probe instant
// query at a fixed 1970-01-01 timestamp. Grafana Cloud / Mimir reject that as
// "validation failed", so Save & test fails even when connectivity and auth are fine.
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	hc, err := s.healthcheck(ctx, req)
	if err != nil {
		return nil, err
	}

	heuristics, err := s.GetHeuristics(ctx, promlib.HeuristicsRequest{PluginContext: req.PluginContext})
	if err != nil {
		backend.Logger.Warn("Failed to get prometheus heuristics", "err", err.Error())
	} else if heuristics != nil {
		jsonDetails, marshalErr := json.Marshal(heuristics)
		if marshalErr != nil {
			backend.Logger.Warn("Failed to marshal heuristics", "err", marshalErr)
		} else {
			hc.JSONDetails = jsonDetails
		}
	}

	return hc, nil
}

func (s *Service) healthcheck(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	now := time.Now().UTC()
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
		return healthCheckMessage("There was an error returned querying the Prometheus API.", err)
	}

	resp, err := s.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries: []backend.DataQuery{
			{
				RefID: healthCheckRefID,
				TimeRange: backend.TimeRange{
					From: now.Add(-time.Second),
					To:   now,
				},
				JSON: b,
			},
		},
	})
	if err != nil {
		return healthCheckMessage("There was an error returned querying the Prometheus API.", err)
	}

	if resp == nil {
		return healthCheckMessage("There was an error returned querying the Prometheus API.", errors.New("empty query response"))
	}

	if dr, ok := resp.Responses[healthCheckRefID]; ok && dr.Error != nil {
		return healthCheckMessage("There was an error returned querying the Prometheus API.", dr.Error)
	}

	return healthCheckMessage("Successfully queried the Prometheus API.", nil)
}

func healthCheckMessage(message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: message,
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: fmt.Sprintf("%s - %s", err.Error(), message),
	}, nil
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
