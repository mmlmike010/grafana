package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addExploreSessionsMigrations(mg *Migrator) {
	exploreSessionsV1 := Table{
		Name: "explore_sessions",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "url", Type: DB_Text, Nullable: false},
			{Name: "panes_json", Type: DB_Text, Nullable: false},
			{Name: "created_at", Type: DB_BigInt, Nullable: false},
			{Name: "updated_at", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "user_id"}},
			{Cols: []string{"uid"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create explore_sessions table v1", NewAddTableMigration(exploreSessionsV1))
	mg.AddMigration("add index explore_sessions.org_id-user_id", NewAddIndexMigration(exploreSessionsV1, exploreSessionsV1.Indices[0]))
	mg.AddMigration("add unique index explore_sessions.uid", NewAddIndexMigration(exploreSessionsV1, exploreSessionsV1.Indices[1]))
}
