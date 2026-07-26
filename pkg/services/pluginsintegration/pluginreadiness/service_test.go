package pluginreadiness

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type fakePreinstall struct {
	pinned map[string]bool
}

func (f *fakePreinstall) IsPreinstalled(pluginID string) bool {
	return false
}

func (f *fakePreinstall) IsPinned(pluginID string) bool {
	return f.pinned[pluginID]
}

func TestGetReadiness_CorePluginIsBlocked(t *testing.T) {
	t.Parallel()

	store := pluginstore.NewFakePluginStore([]pluginstore.Plugin{
		{
			JSONData: plugins.JSONData{
				ID:   "grafana-testdata-datasource",
				Type: plugins.TypeDataSource,
				Info: plugins.Info{Version: "12.0.0"},
			},
			Class:     plugins.ClassCore,
			Signature: plugins.SignatureStatusInternal,
		},
	})

	service := &Service{
		cfg:              &setting.Cfg{BuildVersion: "12.0.0"},
		pluginStore:      store,
		pluginPreinstall: &fakePreinstall{pinned: map[string]bool{}},
	}

	readiness := service.GetReadiness(context.Background(), "grafana-testdata-datasource", "")
	require.False(t, readiness.CanInstall)
	require.NotEmpty(t, readiness.Blockers)
	require.Equal(t, "core-plugin", readiness.Blockers[0].ID)
}

func TestGetReadiness_PinnedPluginIsBlocked(t *testing.T) {
	t.Parallel()

	service := &Service{
		cfg:              &setting.Cfg{BuildVersion: "12.0.0"},
		pluginStore:      pluginstore.NewFakePluginStore(nil),
		pluginPreinstall: &fakePreinstall{pinned: map[string]bool{"my-plugin": true}},
	}

	readiness := service.GetReadiness(context.Background(), "my-plugin", "")
	require.False(t, readiness.CanInstall)
	require.Equal(t, "pinned", readiness.Blockers[0].ID)
}

var _ pluginchecker.Preinstall = (*fakePreinstall)(nil)
