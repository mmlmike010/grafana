package exploresessions

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (s *ServiceImpl) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/explore-sessions", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(s.permissionsMiddleware(s.createHandler, "Failed to create explore session")))
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.permissionsMiddleware(s.listHandler, "Failed to list explore sessions")))
		entities.Get("/:uid", middleware.ReqSignedIn, routing.Wrap(s.permissionsMiddleware(s.getHandler, "Failed to get explore session")))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(s.permissionsMiddleware(s.deleteHandler, "Failed to delete explore session")))
		entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(s.permissionsMiddleware(s.renameHandler, "Failed to rename explore session")))
	})
}

type CallbackHandler func(c *contextmodel.ReqContext) response.Response

func (s *ServiceImpl) permissionsMiddleware(handler CallbackHandler, errorMessage string) CallbackHandler {
	return func(c *contextmodel.ReqContext) response.Response {
		hasAccess := ac.HasAccess(s.accessControl, c)
		if c.GetOrgRole() == org.RoleViewer && !hasAccess(ac.EvalPermission(ac.ActionDatasourcesExplore)) {
			return response.Error(http.StatusUnauthorized, errorMessage, nil)
		}
		return handler(c)
	}
}

func (s *ServiceImpl) createHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateExploreSessionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	session, err := s.CreateExploreSession(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		if errors.Is(err, ErrInvalidName) {
			return response.Error(http.StatusBadRequest, "invalid session name", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create explore session", err)
	}

	return response.JSON(http.StatusOK, ExploreSessionResponse{Result: session})
}

func (s *ServiceImpl) listHandler(c *contextmodel.ReqContext) response.Response {
	sessions, err := s.ListExploreSessions(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list explore sessions", err)
	}

	return response.JSON(http.StatusOK, ExploreSessionListResponse{
		Result: ExploreSessionList{Sessions: sessions},
	})
}

func (s *ServiceImpl) getHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if len(uid) > 0 && !util.IsValidShortUID(uid) {
		return response.Error(http.StatusNotFound, "Explore session not found", nil)
	}

	session, err := s.GetExploreSession(c.Req.Context(), c.SignedInUser, uid)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return response.Error(http.StatusNotFound, "Explore session not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get explore session", err)
	}

	return response.JSON(http.StatusOK, ExploreSessionResponse{Result: session})
}

func (s *ServiceImpl) deleteHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if len(uid) > 0 && !util.IsValidShortUID(uid) {
		return response.Error(http.StatusNotFound, "Explore session not found", nil)
	}

	id, err := s.DeleteExploreSession(c.Req.Context(), c.SignedInUser, uid)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return response.Error(http.StatusNotFound, "Explore session not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete explore session", err)
	}

	return response.JSON(http.StatusOK, DeleteExploreSessionResponse{
		Message: "Session deleted",
		ID:      id,
	})
}

func (s *ServiceImpl) renameHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if len(uid) > 0 && !util.IsValidShortUID(uid) {
		return response.Error(http.StatusNotFound, "Explore session not found", nil)
	}

	cmd := RenameExploreSessionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	session, err := s.RenameExploreSession(c.Req.Context(), c.SignedInUser, uid, cmd)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return response.Error(http.StatusNotFound, "Explore session not found", err)
		}
		if errors.Is(err, ErrInvalidName) {
			return response.Error(http.StatusBadRequest, "invalid session name", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to rename explore session", err)
	}

	return response.JSON(http.StatusOK, ExploreSessionResponse{Result: session})
}
