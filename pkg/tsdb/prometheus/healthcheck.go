package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"

	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib"
	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib/models"
)

const healthCheckRefID = "__healthcheck__"

func (s *Service) checkHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	hc, err := s.queryHealthCheck(ctx, req)
	if err != nil {
		return nil, err
	}

	heuristics, err := s.GetHeuristics(ctx, promlib.HeuristicsRequest{PluginContext: req.PluginContext})
	if err != nil {
		return hc, nil
	}

	jsonDetails, err := json.Marshal(heuristics)
	if err != nil {
		return hc, nil
	}

	hc.JSONDetails = jsonDetails
	return hc, nil
}

func (s *Service) queryHealthCheck(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
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
		return getHealthCheckMessage("There was an error creating the Prometheus health check query.", err)
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

	resp, err := s.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries:       []backend.DataQuery{query},
	})
	if err != nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.", err)
	}

	dataResponse, ok := resp.Responses[healthCheckRefID]
	if !ok {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.", errors.New("missing health check response"))
	}

	if dataResponse.Error != nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.", errors.New(dataResponse.Error.Error()))
	}

	return getHealthCheckMessage("Successfully queried the Prometheus API.", nil)
}

func getHealthCheckMessage(message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: message,
		}, nil
	}

	errorMessage := fmt.Sprintf("%s - %s", err.Error(), message)

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}, nil
}
