package installreadiness

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetReportInstalledPlugin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.BuildVersion = "12.0.0"
	cfg.PluginsAllowUnsigned = []string{"test-plugin"}

	store := pluginstore.NewFakePluginStore(pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "test-plugin",
			Info: plugins.Info{
				Author: plugins.InfoLink{Name: "Test Author"},
			},
			Dependencies: plugins.Dependencies{
				GrafanaDependency: ">=11.0.0",
			},
		},
		Signature:     plugins.SignatureStatusValid,
		SignatureType: plugins.SignatureTypeCommunity,
		SignatureOrg:  "Test Org",
	})

	svc := NewService(cfg, store)
	report := svc.GetReport(context.Background(), "test-plugin")

	require.Equal(t, "12.0.0", report.GrafanaVersion)
	require.True(t, report.AllowUnsignedPlugins)
	require.True(t, report.IsInstalled)
	require.Equal(t, "valid", report.SignatureStatus)
	require.Equal(t, "community", report.SignatureType)
	require.Equal(t, "Test Org", report.SignatureOrg)
	require.Equal(t, ">=11.0.0", report.GrafanaDependency)
	require.Equal(t, "Test Author", report.MaintainerName)
}

func TestGetReportUnknownPlugin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.BuildVersion = "12.0.0"
	cfg.Env = "production"

	svc := NewService(cfg, pluginstore.NewFakePluginStore())
	report := svc.GetReport(context.Background(), "missing-plugin")

	require.Equal(t, "12.0.0", report.GrafanaVersion)
	require.False(t, report.IsInstalled)
	require.False(t, report.AllowUnsignedPlugins)
}
