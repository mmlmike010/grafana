package exploresessions

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrSessionNotFound = errors.New("explore session not found")
	ErrInvalidName   = errors.New("invalid session name")
)

const maxSessionNameLength = 255

// ExploreSession is the database model for a saved Explore session.
type ExploreSession struct {
	ID         int64  `xorm:"pk autoincr 'id'"`
	UID        string `xorm:"uid"`
	OrgID      int64  `xorm:"org_id"`
	UserID     int64  `xorm:"user_id"`
	Name       string `xorm:"name"`
	URL        string `xorm:"url"`
	PanesJSON  string `xorm:"panes_json"`
	CreatedAt  int64  `xorm:"created_at"`
	UpdatedAt  int64  `xorm:"updated_at"`
}

type ExploreSessionDTO struct {
	UID       string           `json:"uid"`
	Name      string           `json:"name"`
	URL       string           `json:"url"`
	Panes     *simplejson.Json `json:"panes"`
	CreatedAt int64            `json:"createdAt"`
	UpdatedAt int64            `json:"updatedAt"`
}

type ExploreSessionResponse struct {
	Result ExploreSessionDTO `json:"result"`
}

type ExploreSessionListResponse struct {
	Result ExploreSessionList `json:"result"`
}

type ExploreSessionList struct {
	Sessions []ExploreSessionDTO `json:"sessions"`
}

type CreateExploreSessionCommand struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	// Panes holds the Explore panes object from the URL (same shape as the `panes` query param).
	Panes *simplejson.Json `json:"panes"`
}

type RenameExploreSessionCommand struct {
	Name string `json:"name"`
}

type DeleteExploreSessionResponse struct {
	Message string `json:"message"`
	ID      int64  `json:"id"`
}
