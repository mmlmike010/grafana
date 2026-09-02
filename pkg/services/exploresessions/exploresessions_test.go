package exploresessions

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	service    *ExploreSessionsService
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
		service := &ExploreSessionsService{
			Cfg:           setting.NewCfg(),
			store:         sqlStore,
			now:           time.Now,
			accessControl: accesscontrolmock.New(),
		}
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
			permissions[testUserID] = map[string][]string{
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
			service:  service,
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

func validateAndUnMarshalResponse(t *testing.T, resp response.Response) ExploreSessionResponse {
	t.Helper()
	require.Equal(t, 200, resp.Status())
	var result ExploreSessionResponse
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)
	return result
}

func TestIntegrationCreateExploreSession(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "Creating an explore session succeeds for editors", false, false,
		func(t *testing.T, sc scenarioContext) {
			command := CreateExploreSessionCommand{
				Name:      "Incident-123",
				URL:       "/explore?schemaVersion=1&panes=%7B%7D",
				PanesJSON: `{"abc":{"datasource":"loki","queries":[],"range":{"from":"now-1h","to":"now"}}}`,
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.permissionsMiddleware(sc.service.createHandler, "Failed to create explore session")(sc.reqContext)
			result := validateAndUnMarshalResponse(t, resp)
			require.Equal(t, "Incident-123", result.Result.Name)
			require.NotEmpty(t, result.Result.UID)
		})

	testScenario(t, "Creating an explore session fails for viewers without explore permission", true, false,
		func(t *testing.T, sc scenarioContext) {
			command := CreateExploreSessionCommand{
				Name:      "Incident-123",
				URL:       "/explore?panes={}",
				PanesJSON: `{}`,
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.permissionsMiddleware(sc.service.createHandler, "Failed to create explore session")(sc.reqContext)
			require.Equal(t, 401, resp.Status())
		})
}

func TestIntegrationExploreSessionCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "List, get, rename, and delete explore sessions", false, false,
		func(t *testing.T, sc scenarioContext) {
			created, err := sc.service.CreateExploreSession(context.Background(), sc.reqContext.SignedInUser, CreateExploreSessionCommand{
				Name:      "Session A",
				URL:       "/explore?panes=a",
				PanesJSON: `{"a":{}}`,
			})
			require.NoError(t, err)

			list, err := sc.service.ListExploreSessions(context.Background(), sc.reqContext.SignedInUser, ListExploreSessionsQuery{})
			require.NoError(t, err)
			require.Equal(t, 1, list.TotalCount)
			require.Equal(t, "Session A", list.Sessions[0].Name)

			got, err := sc.service.GetExploreSession(context.Background(), sc.reqContext.SignedInUser, created.UID)
			require.NoError(t, err)
			require.Equal(t, created.UID, got.UID)

			renamed, err := sc.service.RenameExploreSession(context.Background(), sc.reqContext.SignedInUser, created.UID, RenameExploreSessionCommand{Name: "Session B"})
			require.NoError(t, err)
			require.Equal(t, "Session B", renamed.Name)

			deleted, err := sc.service.DeleteExploreSession(context.Background(), sc.reqContext.SignedInUser, created.UID)
			require.NoError(t, err)
			require.Equal(t, int64(1), deleted)

			_, err = sc.service.GetExploreSession(context.Background(), sc.reqContext.SignedInUser, created.UID)
			require.ErrorIs(t, err, ErrSessionNotFound)
		})
}
