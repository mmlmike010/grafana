package exploresessions

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func (s *ServiceImpl) createSession(ctx context.Context, user *user.SignedInUser, cmd CreateExploreSessionCommand) (ExploreSessionDTO, error) {
	name := strings.TrimSpace(cmd.Name)
	if name == "" || len(name) > maxSessionNameLength) {
		return ExploreSessionDTO{}, ErrInvalidName
	}

	panesStr := "{}"
	if cmd.Panes != nil {
		b, err := cmd.Panes.MarshalJSON()
		if err != nil {
			return ExploreSessionDTO{}, err
		}
		panesStr = string(b)
	}

	now := s.now().Unix()
	row := ExploreSession{
		UID:       util.GenerateShortUID(),
		OrgID:     user.OrgID,
		UserID:    user.UserID,
		Name:      name,
		URL:       cmd.URL,
		PanesJSON: panesStr,
		CreatedAt: now,
		UpdatedAt: now,
	}

	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(&row)
		return err
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}

	return sessionToDTO(row)
}

func (s *ServiceImpl) listSessions(ctx context.Context, user *user.SignedInUser) ([]ExploreSessionDTO, error) {
	var rows []ExploreSession
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		return session.Where("org_id = ? AND user_id = ?", user.OrgID, user.UserID).
			OrderBy("updated_at DESC").
			Find(&rows)
	})
	if err != nil {
		return nil, err
	}

	out := make([]ExploreSessionDTO, 0, len(rows))
	for _, row := range rows {
		dto, err := sessionToDTO(row)
		if err != nil {
			return nil, err
		}
		out = append(out, dto)
	}
	return out, nil
}

func (s *ServiceImpl) getSession(ctx context.Context, user *user.SignedInUser, uid string) (ExploreSessionDTO, error) {
	var row ExploreSession
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		has, err := session.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Get(&row)
		if err != nil {
			return err
		}
		if !has {
			return ErrSessionNotFound
		}
		return nil
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}
	return sessionToDTO(row)
}

func (s *ServiceImpl) deleteSession(ctx context.Context, user *user.SignedInUser, uid string) (int64, error) {
	var deleted int64
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		id, err := session.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Delete(&ExploreSession{})
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

func (s *ServiceImpl) renameSession(ctx context.Context, user *user.SignedInUser, uid string, cmd RenameExploreSessionCommand) (ExploreSessionDTO, error) {
	name := strings.TrimSpace(cmd.Name)
	if name == "" || len(name) > maxSessionNameLength) {
		return ExploreSessionDTO{}, ErrInvalidName
	}

	var row ExploreSession
	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		has, err := session.Where("org_id = ? AND user_id = ? AND uid = ?", user.OrgID, user.UserID, uid).Get(&row)
		if err != nil {
			return err
		}
		if !has {
			return ErrSessionNotFound
		}
		row.Name = name
		row.UpdatedAt = s.now().Unix()
		_, err = session.ID(row.ID).Cols("name", "updated_at").Update(&row)
		return err
	})
	if err != nil {
		return ExploreSessionDTO{}, err
	}
	return sessionToDTO(row)
}

func sessionToDTO(row ExploreSession) (ExploreSessionDTO, error) {
	panes, err := simplejson.NewJson([]byte(row.PanesJSON))
	if err != nil {
		return ExploreSessionDTO{}, err
	}
	return ExploreSessionDTO{
		UID:       row.UID,
		Name:      row.Name,
		URL:       row.URL,
		Panes:     panes,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}, nil
}
