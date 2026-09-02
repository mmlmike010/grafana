package exploresessions

import (
	"errors"
)

var (
	ErrSessionNotFound      = errors.New("explore session not found")
	ErrSessionNameRequired  = errors.New("explore session name is required")
	ErrSessionURLRequired   = errors.New("explore session url is required")
	ErrSessionPanesRequired = errors.New("explore session panes are required")
)

// ExploreSession is the XORM model for a saved Explore session.
type ExploreSession struct {
	ID        int64  `xorm:"pk autoincr 'id'"`
	UID       string `xorm:"uid"`
	OrgID     int64  `xorm:"org_id"`
	UserID    int64  `xorm:"user_id"`
	Name      string `xorm:"name"`
	URL       string `xorm:"url"`
	PanesJSON string `xorm:"panes_json"`
	CreatedAt int64  `xorm:"created_at"`
	UpdatedAt int64  `xorm:"updated_at"`
}

// ExploreSessionDTO is the API representation of a saved Explore session.
type ExploreSessionDTO struct {
	UID       string `json:"uid"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	PanesJSON string `json:"panesJson"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// ExploreSessionResponse wraps a single session DTO.
type ExploreSessionResponse struct {
	Result ExploreSessionDTO `json:"result"`
}

// ExploreSessionSearchResult is a paginated list of sessions.
type ExploreSessionSearchResult struct {
	TotalCount int                 `json:"totalCount"`
	Sessions   []ExploreSessionDTO `json:"sessions"`
	Page       int                 `json:"page"`
	PerPage    int                 `json:"perPage"`
}

// ExploreSessionSearchResponse wraps a search result.
type ExploreSessionSearchResponse struct {
	Result ExploreSessionSearchResult `json:"result"`
}

// ExploreSessionDeleteResponse is returned after deleting a session.
type ExploreSessionDeleteResponse struct {
	ID      int64  `json:"id"`
	Message string `json:"message"`
}

// CreateExploreSessionCommand is the body for creating a saved session.
// swagger:model
type CreateExploreSessionCommand struct {
	// Display name for the saved session.
	// required: true
	Name string `json:"name"`
	// Explore URL path (e.g. /explore?schemaVersion=1&panes=...).
	// required: true
	URL string `json:"url"`
	// JSON-encoded panes map matching Explore URL state.
	// required: true
	PanesJSON string `json:"panesJson"`
}

// RenameExploreSessionCommand is the body for renaming a saved session.
// swagger:model
type RenameExploreSessionCommand struct {
	// Updated display name.
	// required: true
	Name string `json:"name"`
}

// ListExploreSessionsQuery holds list/search parameters.
type ListExploreSessionsQuery struct {
	SearchString string
	Page         int
	Limit        int
}
