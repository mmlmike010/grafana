package pluginreadiness

import (
	"context"
	"fmt"
	"runtime"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Issue struct {
	ID       string `json:"id"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

type Readiness struct {
	PluginID                string                  `json:"pluginId"`
	GrafanaVersion          string                  `json:"grafanaVersion"`
	System                  string                  `json:"system"`
	RequestedVersion        string                  `json:"requestedVersion,omitempty"`
	LatestCompatibleVersion string                  `json:"latestCompatibleVersion,omitempty"`
	GrafanaDependency       string                  `json:"grafanaDependency,omitempty"`
	IsCompatible            bool                    `json:"isCompatible"`
	Signature               plugins.SignatureStatus `json:"signature,omitempty"`
	SignatureType           plugins.SignatureType   `json:"signatureType,omitempty"`
	SignatureOrg            string                  `json:"signatureOrg,omitempty"`
	IsSigned                bool                    `json:"isSigned"`
	CanInstall              bool                    `json:"canInstall"`
	Blockers                []Issue                 `json:"blockers"`
	Warnings                []Issue                 `json:"warnings"`
	ChangelogPath           string                  `json:"changelogPath,omitempty"`
	MaintainerName          string                  `json:"maintainerName,omitempty"`
	MaintainerURL           string                  `json:"maintainerUrl,omitempty"`
}

type Service struct {
	cfg              *setting.Cfg
	pluginRepo       *repo.Manager
	pluginStore      pluginstore.Store
	pluginPreinstall pluginchecker.Preinstall
}

func ProvideService(
	cfg *setting.Cfg,
	pluginRepo *repo.Manager,
	pluginStore pluginstore.Store,
	pluginPreinstall pluginchecker.Preinstall,
) *Service {
	return &Service{
		cfg:              cfg,
		pluginRepo:       pluginRepo,
		pluginStore:      pluginStore,
		pluginPreinstall: pluginPreinstall,
	}
}

func (s *Service) GetReadiness(ctx context.Context, pluginID, requestedVersion string) Readiness {
	compatOpts := repo.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)
	systemLabel := ""
	if sys, ok := compatOpts.System(); ok {
		systemLabel = sys.OSAndArch()
	}

	readiness := Readiness{
		PluginID:         pluginID,
		GrafanaVersion:   s.cfg.BuildVersion,
		System:           systemLabel,
		RequestedVersion: requestedVersion,
		ChangelogPath:    fmt.Sprintf("/plugins/%s?page=changelog", pluginID),
		Blockers:         []Issue{},
		Warnings:         []Issue{},
	}

	if plugin, exists := s.pluginStore.Plugin(ctx, pluginID); exists {
		readiness.Signature = plugin.Signature
		readiness.SignatureType = plugin.SignatureType
		readiness.SignatureOrg = plugin.SignatureOrg
		readiness.MaintainerName = plugin.Info.Author.Name
		readiness.MaintainerURL = plugin.Info.Author.URL

		if plugin.IsCorePlugin() {
			readiness.Blockers = append(readiness.Blockers, Issue{
				ID:       "core-plugin",
				Message:  "Core plugins cannot be installed or changed via the catalog.",
				Severity: "blocker",
			})
		}

		if plugin.Signature == plugins.SignatureStatusInvalid {
			readiness.Warnings = append(readiness.Warnings, Issue{
				ID:       "invalid-signature",
				Message:  "Installed plugin signature is invalid.",
				Severity: "warning",
			})
		}
	}

	if s.pluginPreinstall.IsPinned(pluginID) {
		readiness.Blockers = append(readiness.Blockers, Issue{
			ID:       "pinned",
			Message:  "This plugin is pinned and cannot be updated from the catalog.",
			Severity: "blocker",
		})
	}

	versions, err := s.pluginRepo.ListPluginVersions(ctx, pluginID, compatOpts)
	if err != nil {
		readiness.Blockers = append(readiness.Blockers, Issue{
			ID:       "catalog-unavailable",
			Message:  "Unable to verify plugin compatibility with grafana.com.",
			Severity: "blocker",
		})
		readiness.applySignatureSummary()
		readiness.CanInstall = len(readiness.Blockers) == 0 && readiness.IsCompatible
		return readiness
	}

	latest, latestErr := repo.SelectSystemCompatibleVersion(s.pluginRepo.Logger(), versions, pluginID, "", compatOpts)
	if latestErr == nil {
		readiness.LatestCompatibleVersion = latest.Version
		readiness.IsCompatible = true
		for _, version := range versions {
			if version.Version == latest.Version {
				readiness.GrafanaDependency = version.GrafanaDependency
				break
			}
		}
	} else {
		readiness.IsCompatible = false
		readiness.Blockers = append(readiness.Blockers, Issue{
			ID:       "incompatible",
			Message:  "No compatible version is available for this Grafana instance.",
			Severity: "blocker",
		})
	}

	if requestedVersion != "" && readiness.IsCompatible {
		_, versionErr := repo.SelectSystemCompatibleVersion(s.pluginRepo.Logger(), versions, pluginID, requestedVersion, compatOpts)
		if versionErr != nil {
			readiness.IsCompatible = false
			readiness.Blockers = append(readiness.Blockers, Issue{
				ID:       "version-incompatible",
				Message:  fmt.Sprintf("Version %s is not compatible with this Grafana instance.", requestedVersion),
				Severity: "blocker",
			})
		}
	}

	readiness.applySignatureSummary()
	readiness.CanInstall = len(readiness.Blockers) == 0 && readiness.IsCompatible
	return readiness
}

func (r *Readiness) applySignatureSummary() {
	if r.Signature == "" {
		r.Signature = plugins.SignatureStatusUnsigned
	}

	r.IsSigned = r.Signature == plugins.SignatureStatusValid || r.Signature == plugins.SignatureStatusInternal
	if !r.IsSigned && r.Signature != plugins.SignatureStatusModified {
		r.Warnings = append(r.Warnings, Issue{
			ID:       "unsigned",
			Message:  "Plugin is not signed by Grafana.",
			Severity: "warning",
		})
	}
}
