package exploresessions

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(
	cfg *setting.Cfg,
	sqlStore db.DB,
	routeRegister routing.RouteRegister,
	accessControl ac.AccessControl,
) *ExploreSessionsService {
	s := &ExploreSessionsService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("explore-sessions"),
		now:           time.Now,
		accessControl: accessControl,
	}
	s.registerAPIEndpoints()
	return s
}

// Service is the public interface for saved Explore sessions.
type Service interface {
	CreateExploreSession(ctx context.Context, user *user.SignedInUser, cmd CreateExploreSessionCommand) (ExploreSessionDTO, error)
	ListExploreSessions(ctx context.Context, user *user.SignedInUser, query ListExploreSessionsQuery) (ExploreSessionSearchResult, error)
	GetExploreSession(ctx context.Context, user *user.SignedInUser, uid string) (ExploreSessionDTO, error)
	DeleteExploreSession(ctx context.Context, user *user.SignedInUser, uid string) (int64, error)
	RenameExploreSession(ctx context.Context, user *user.SignedInUser, uid string, cmd RenameExploreSessionCommand) (ExploreSessionDTO, error)
}

type ExploreSessionsService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
	accessControl ac.AccessControl
}

func (s *ExploreSessionsService) CreateExploreSession(ctx context.Context, user *user.SignedInUser, cmd CreateExploreSessionCommand) (ExploreSessionDTO, error) {
	return s.createSession(ctx, user, cmd)
}

func (s *ExploreSessionsService) ListExploreSessions(ctx context.Context, user *user.SignedInUser, query ListExploreSessionsQuery) (ExploreSessionSearchResult, error) {
	return s.listSessions(ctx, user, query)
}

func (s *ExploreSessionsService) GetExploreSession(ctx context.Context, user *user.SignedInUser, uid string) (ExploreSessionDTO, error) {
	return s.getSession(ctx, user, uid)
}

func (s *ExploreSessionsService) DeleteExploreSession(ctx context.Context, user *user.SignedInUser, uid string) (int64, error) {
	return s.deleteSession(ctx, user, uid)
}

func (s *ExploreSessionsService) RenameExploreSession(ctx context.Context, user *user.SignedInUser, uid string, cmd RenameExploreSessionCommand) (ExploreSessionDTO, error) {
	return s.renameSession(ctx, user, uid, cmd)
}
