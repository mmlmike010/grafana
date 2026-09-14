package exploresessions

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationListExploreSessions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "empty history returns an empty list", false, false,
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.listHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var out ExploreSessionListResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &out))
			require.Empty(t, out.Result.Sessions)
		})

	testScenario(t, "list returns sessions newest-first for the signed-in user", false, false,
		func(t *testing.T, sc scenarioContext) {
			start := time.Now()
			sc.service.now = func() time.Time { return start }
			createTestSession(t, sc, "first")
			sc.service.now = func() time.Time { return start.Add(time.Second) }
			createTestSession(t, sc, "second")

			resp := sc.service.listHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var out ExploreSessionListResponse
			require.NoError(t, json.Unmarshal(resp.Body(), &out))
			require.Len(t, out.Result.Sessions, 2)
			require.Equal(t, "second", out.Result.Sessions[0].Name)
			require.Equal(t, "first", out.Result.Sessions[1].Name)
		})
}
