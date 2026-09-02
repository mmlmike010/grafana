package exploresessions

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func (s *ExploreSessionsService) createSession(ctx context.Context, user *user.SignedInUser, cmd CreateExploreSessionCommand) (ExploreSessionDTO, error) {
	name := strings.TrimSpace(cmd.Name)
	if name == "" {
		return ExploreSessionDTO{}, ErrSessionNameRequired
	}
	if strings.TrimSpace(cmd.URL) == "" {
		return ExploreSessionDTO{}, ErrSessionURLRequired
	}
	if strings.TrimSpace(cmd.PanesJSON) == "" {
		return ExploreSessionDTO{}, ErrSessionPanesRequired
	}

	now := s.now().Unix()
	session := ExploreSession{
		UID:       util.GenerateShortUID(),
		OrgID:     user.OrgID,
		UserID:    user.UserID,
		Name:      name,
		URL:       cmd.URL,
		PanesJSON: cmd.PanesJSON,
		CreatedAt: now,
		UpdatedAt: now,
	}

	err := s.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		_, err := dbSession.Insert(&session)
		return err
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}

	return toDTO(session), nil
}

func (s *ExploreSessionsService) listSessions(ctx context.Context, user *user.SignedInUser, query ListExploreSessionsQuery) (ExploreSessionSearchResult, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 {
		query.Limit = 100
	}

	search := strings.TrimSpace(query.SearchString)
	var sessions []ExploreSession
	var totalCount int64

	err := s.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		countSess := dbSession.Table("explore_sessions").Where("org_id = ? AND user_id = ?", user.OrgID, user.UserID)
		if search != "" {
			countSess = countSess.Where("name LIKE ?", "%"+search+"%")
		}
		count, err := countSess.Count(&ExploreSession{})
		if err != nil {
			return err
		}
		totalCount = count

		listSess := dbSession.Table("explore_sessions").Where("org_id = ? AND user_id = ?", user.OrgID, user.UserID)
		if search != "" {
			listSess = listSess.Where("name LIKE ?", "%"+search+"%")
		}
		offset := (query.Page - 1) * query.Limit
		return listSess.OrderBy("updated_at DESC").Limit(query.Limit, offset).Find(&sessions)
	})
	if err != nil {
		return ExploreSessionSearchResult{}, err
	}

	dtos := make([]ExploreSessionDTO, 0, len(sessions))
	for _, session := range sessions {
		dtos = append(dtos, toDTO(session))
	}

	return ExploreSessionSearchResult{
		TotalCount: int(totalCount),
		Sessions:   dtos,
		Page:       query.Page,
		PerPage:    query.Limit,
	}, nil
}

func (s *ExploreSessionsService) getSession(ctx context.Context, user *user.SignedInUser, uid string) (ExploreSessionDTO, error) {
	var session ExploreSession
	err := s.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Get(&session)
		if err != nil {
			return err
		}
		if !exists {
			return ErrSessionNotFound
		}
		return nil
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}
	return toDTO(session), nil
}

func (s *ExploreSessionsService) deleteSession(ctx context.Context, user *user.SignedInUser, uid string) (int64, error) {
	var deleted int64
	err := s.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		id, err := dbSession.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Delete(&ExploreSession{})
		if err != nil {
			return err
		}
		if id == 0 {
			return ErrSessionNotFound
		}
		deleted = id
		return nil
	})
	return deleted, err
}

func (s *ExploreSessionsService) renameSession(ctx context.Context, user *user.SignedInUser, uid string, cmd RenameExploreSessionCommand) (ExploreSessionDTO, error) {
	name := strings.TrimSpace(cmd.Name)
	if name == "" {
		return ExploreSessionDTO{}, ErrSessionNameRequired
	}

	var session ExploreSession
	err := s.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Get(&session)
		if err != nil {
			return err
		}
		if !exists {
			return ErrSessionNotFound
		}
		session.Name = name
		session.UpdatedAt = s.now().Unix()
		_, err = dbSession.ID(session.ID).Cols("name", "updated_at").Update(&session)
		return err
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}
	return toDTO(session), nil
}

func toDTO(session ExploreSession) ExploreSessionDTO {
	return ExploreSessionDTO{
		UID:       session.UID,
		Name:      session.Name,
		URL:       session.URL,
		PanesJSON: session.PanesJSON,
		CreatedAt: session.CreatedAt,
		UpdatedAt: session.UpdatedAt,
	}
}
