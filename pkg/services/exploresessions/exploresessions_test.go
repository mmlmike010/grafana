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

	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/web"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

var (
	testOrgID  = int64(1)
	testUserID = int64(1)
)

func TestExploreSessionsCRUD(t *testing.T) {
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	svc := &ServiceImpl{
		store:         sqlStore,
		Cfg:           cfg,
		accessControl: accesscontrolmock.New(),
		now:           time.Now,
	}
	svc.Cfg.ExploreEnabled = true

	quotaService := quotatest.New(false, nil)
	orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		sqlStore, orgSvc, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(), nil,
	)
	require.NoError(t, err)

	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Email: "u@test.com",
		Name:  "U",
		Login: "u",
	})
	require.NoError(t, err)

	usr := user.SignedInUser{
		UserID:      testUserID,
		OrgID:       testOrgID,
		OrgRole:     org.RoleEditor,
		LastSeenAt:  time.Now(),
		Permissions: map[int64]map[string][]string{},
	}

	ctx := web.Context{Req: &http.Request{
		Header: http.Header{},
		Form:   url.Values{},
	}}
	ctx.Req.Header.Add("Content-Type", "application/json")

	reqCtx := &contextmodel.ReqContext{
		Context:      &ctx,
		SignedInUser: &usr,
	}

	cmd := CreateExploreSessionCommand{
		Name: "incident-1",
		URL:  "/explore?schemaVersion=1&panes=%7B%7D&orgId=1",
		Panes: simplejson.NewFromAny(map[string]any{
			"left": map[string]any{"datasource": "prom"},
		}),
	}
	ctx.Req.Body = mockBody(cmd)
	resp := svc.createHandler(reqCtx)
	require.Equal(t, http.StatusOK, resp.Status())

	var createResp ExploreSessionResponse
	require.NoError(t, json.Unmarshal(resp.Body(), &createResp))
	uid := createResp.Result.UID
	require.NotEmpty(t, uid)

	ctx.Req = &http.Request{Header: http.Header{}, Form: url.Values{}}
	ctx.Req.Header.Add("Content-Type", "application/json")
	reqCtx.Context = &ctx
	listResp := svc.listHandler(reqCtx)
	require.Equal(t, http.StatusOK, listResp.Status())
	var listOut ExploreSessionListResponse
	require.NoError(t, json.Unmarshal(listResp.Body(), &listOut))
	require.Len(t, listOut.Result.Sessions, 1)

	ctx.Req = web.SetURLParams(ctx.Req, map[string]string{":uid": uid})
	reqCtx.Context = &ctx
	getResp := svc.getHandler(reqCtx)
	require.Equal(t, http.StatusOK, getResp.Status())

	ctx.Req.Body = mockBody(RenameExploreSessionCommand{Name: "incident-renamed"})
	patchResp := svc.renameHandler(reqCtx)
	require.Equal(t, http.StatusOK, patchResp.Status())

	delResp := svc.deleteHandler(reqCtx)
	require.Equal(t, http.StatusOK, delResp.Status())

	listResp2 := svc.listHandler(reqCtx)
	var listOut2 ExploreSessionListResponse
	require.NoError(t, json.Unmarshal(listResp2.Body(), &listOut2))
	require.Len(t, listOut2.Result.Sessions, 0)
}

func TestExploreSessionsViewerNeedsExplorePermission(t *testing.T) {
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	svc := &ServiceImpl{
		store:         sqlStore,
		Cfg:           cfg,
		accessControl: accesscontrolmock.New(),
		now:           time.Now,
	}
	svc.Cfg.ExploreEnabled = true

	usr := user.SignedInUser{
		UserID:      testUserID,
		OrgID:       testOrgID,
		OrgRole:     org.RoleViewer,
		LastSeenAt:  time.Now(),
		Permissions: map[int64]map[string][]string{},
	}

	ctx := web.Context{Req: &http.Request{Header: http.Header{}, Form: url.Values{}}}
	reqCtx := &contextmodel.ReqContext{
		Context:      &ctx,
		SignedInUser: &usr,
	}

	resp := svc.listHandler(reqCtx)
	require.Equal(t, http.StatusUnauthorized, resp.Status())

	usr.Permissions = map[int64]map[string][]string{
		testUserID: {"datasources:explore": {}},
	}
	resp2 := svc.listHandler(reqCtx)
	require.Equal(t, http.StatusOK, resp2.Status())
}

func mockBody(v any) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}
