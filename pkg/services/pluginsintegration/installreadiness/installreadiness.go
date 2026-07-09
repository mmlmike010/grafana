package installreadiness

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

// Report summarizes server-side context for plugin install governance.
type Report struct {
	GrafanaVersion       string `json:"grafanaVersion"`
	AllowUnsignedPlugins bool   `json:"allowUnsignedPlugins"`
	PluginID             string `json:"pluginId"`
	IsInstalled          bool   `json:"isInstalled"`
	SignatureStatus      string `json:"signatureStatus,omitempty"`
	SignatureType        string `json:"signatureType,omitempty"`
	SignatureOrg         string `json:"signatureOrg,omitempty"`
	GrafanaDependency    string `json:"grafanaDependency,omitempty"`
	MaintainerName       string `json:"maintainerName,omitempty"`
}

type Service struct {
	cfg   *setting.Cfg
	store pluginstore.Store
}

func NewService(cfg *setting.Cfg, store pluginstore.Store) *Service {
	return &Service{cfg: cfg, store: store}
}

func (s *Service) GetReport(ctx context.Context, pluginID string) Report {
	report := Report{
		GrafanaVersion:       s.cfg.BuildVersion,
		AllowUnsignedPlugins: s.canLoadUnsigned(pluginID),
		PluginID:             pluginID,
	}

	plugin, exists := s.store.Plugin(ctx, pluginID)
	if !exists {
		return report
	}

	report.IsInstalled = true
	report.SignatureStatus = string(plugin.Signature)
	report.SignatureType = string(plugin.SignatureType)
	report.SignatureOrg = plugin.SignatureOrg
	report.MaintainerName = plugin.Info.Author.Name

	if dep := plugin.Dependencies.GrafanaDependency; dep != "" {
		report.GrafanaDependency = dep
	} else {
		report.GrafanaDependency = plugin.Dependencies.GrafanaVersion
	}

	return report
}

func (s *Service) canLoadUnsigned(pluginID string) bool {
	if s.cfg.Env == setting.Dev {
		return true
	}
	return slices.Contains(s.cfg.PluginsAllowUnsigned, pluginID)
}
