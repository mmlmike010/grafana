package exploresessions

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

var (
	testOrgID  = int64(1)
	testUserID = int64(1)
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type scenarioContext struct {
	ctx        *web.Context
	service    *ServiceImpl
	reqContext *contextmodel.ReqContext
	sqlStore   db.DB
}

func testScenario(t *testing.T, desc string, isViewer bool, hasDatasourceExplorePermission bool, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		ctx := web.Context{Req: &http.Request{
			Header: http.Header{},
			Form:   url.Values{},
		}}
		ctx.Req.Header.Add("Content-Type", "application/json")
		sqlStore, cfg := db.InitTestDBWithCfg(t)
		service := ServiceImpl{
			Cfg:           setting.NewCfg(),
			store:         sqlStore,
			now:           time.Now,
			accessControl: accesscontrolmock.New(),
		}
		service.Cfg.ExploreEnabled = true
		quotaService := quotatest.New(false, nil)
		orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, cfg, nil, nil, tracing.InitializeTracerForTest(),
			quotaService, supportbundlestest.NewFakeBundleService(), nil,
		)
		require.NoError(t, err)

		var role identity.RoleType
		if isViewer {
			role = org.RoleViewer
		} else {
			role = org.RoleEditor
		}

		permissions := make(map[int64]map[string][]string)
		if hasDatasourceExplorePermission {
			permissions[testOrgID] = map[string][]string{
				"datasources:explore": {},
			}
		}

		usr := user.SignedInUser{
			UserID:      testUserID,
			Name:        "Signed In User",
			Login:       "signed_in_user",
			Email:       "signed.in.user@test.com",
			OrgID:       testOrgID,
			OrgRole:     role,
			LastSeenAt:  service.now(),
			Permissions: permissions,
		}

		_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Email: "signed.in.user@test.com",
			Name:  "Signed In User",
			Login: "signed_in_user",
		})
		require.NoError(t, err)

		sc := scenarioContext{
			ctx:      &ctx,
			service:  &service,
			sqlStore: sqlStore,
			reqContext: &contextmodel.ReqContext{
				Context:      &ctx,
				SignedInUser: &usr,
			},
		}
		fn(t, sc)
	})
}

func mockRequestBody(v any) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}

func createTestSession(t *testing.T, sc scenarioContext, name string) ExploreSessionResponse {
	t.Helper()
	command := CreateExploreSessionCommand{
		Name: name,
		URL:  "/explore?schemaVersion=1&panes=%7B%7D&orgId=1",
		Panes: simplejson.NewFromAny(map[string]any{
			"left": map[string]any{"datasource": "prom"},
		}),
	}
	sc.reqContext.Req.Body = mockRequestBody(command)
	resp := sc.service.createHandler(sc.reqContext)
	require.Equalf(t, http.StatusOK, resp.Status(), "create response: %s", resp.Body())

	var result ExploreSessionResponse
	require.NoError(t, json.Unmarshal(resp.Body(), &result))
	require.NotEmpty(t, result.Result.UID)
	return result
}

func TestIntegrationExploreSessionsCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "create, list, get, rename, and delete a saved session", false, false,
		func(t *testing.T, sc scenarioContext) {
			created := createTestSession(t, sc, "incident-1")
			uid := created.Result.UID
			require.Equal(t, "incident-1", created.Result.Name)
			require.Equal(t, "prom", created.Result.Panes.GetPath("left", "datasource").MustString())

			listResp := sc.service.listHandler(sc.reqContext)
			require.Equal(t, http.StatusOK, listResp.Status())
			var listOut ExploreSessionListResponse
			require.NoError(t, json.Unmarshal(listResp.Body(), &listOut))
			require.Len(t, listOut.Result.Sessions, 1)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": uid})
			getResp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, http.StatusOK, getResp.Status())

			sc.reqContext.Req.Body = mockRequestBody(RenameExploreSessionCommand{Name: "incident-renamed"})
			patchResp := sc.service.renameHandler(sc.reqContext)
			require.Equal(t, http.StatusOK, patchResp.Status())
			var renamed ExploreSessionResponse
			require.NoError(t, json.Unmarshal(patchResp.Body(), &renamed))
			require.Equal(t, "incident-renamed", renamed.Result.Name)

			delResp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, http.StatusOK, delResp.Status())

			listResp2 := sc.service.listHandler(sc.reqContext)
			var listOut2 ExploreSessionListResponse
			require.NoError(t, json.Unmarshal(listResp2.Body(), &listOut2))
			require.Len(t, listOut2.Result.Sessions, 0)
		})
}

func TestIntegrationExploreSessionsValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "empty name is rejected", false, false,
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Body = mockRequestBody(CreateExploreSessionCommand{Name: "   ", URL: "/explore"})
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, http.StatusBadRequest, resp.Status())
		})

	testScenario(t, "name longer than 255 is rejected", false, false,
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.Req.Body = mockRequestBody(CreateExploreSessionCommand{
				Name: strings.Repeat("a", maxSessionNameLength+1),
				URL:  "/explore",
			})
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, http.StatusBadRequest, resp.Status())
		})

	testScenario(t, "missing session returns 404", false, false,
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": "missing1"})
			resp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, http.StatusNotFound, resp.Status())
		})
}

func TestIntegrationExploreSessionsViewerNeedsExplorePermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "viewer without explore permission is unauthorized", true, false,
		func(t *testing.T, sc scenarioContext) {
			wrapped := sc.service.permissionsMiddleware(sc.service.listHandler, "Failed to list explore sessions")
			resp := wrapped(sc.reqContext)
			require.Equal(t, http.StatusUnauthorized, resp.Status())
		})

	testScenario(t, "viewer with explore permission can list sessions", true, true,
		func(t *testing.T, sc scenarioContext) {
			wrapped := sc.service.permissionsMiddleware(sc.service.listHandler, "Failed to list explore sessions")
			resp := wrapped(sc.reqContext)
			require.Equal(t, http.StatusOK, resp.Status())
		})
}

func TestIntegrationExploreSessionsAreScopedToUser(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "another user cannot read or delete a session", false, false,
		func(t *testing.T, sc scenarioContext) {
			created := createTestSession(t, sc, "mine")
			sc.reqContext.SignedInUser.UserID = 99
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": created.Result.UID})

			getResp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, http.StatusNotFound, getResp.Status())

			delResp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, http.StatusNotFound, delResp.Status())
		})
}
