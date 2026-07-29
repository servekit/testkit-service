package main

import (
	"testing"

	"github.com/servekit/go-common/dbx"
	"github.com/stretchr/testify/require"
)

// TestRunMigration_CreatesAllTables drives runMigration against a real
// (test-container) PostgreSQL instance and spot-checks that one representative
// table per DB-bearing downstream is created. gid-service has no DB and
// contributes no tables. testkit owns no tables in P1.
func TestRunMigration_CreatesAllTables(t *testing.T) {
	db := dbx.SetupTestDB(t)
	require.NoError(t, runMigration(db))

	rows, err := db.Raw(`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public'
		AND tablename IN ('users', 'storage_files', 'message_email_records')
	`).Rows()
	require.NoError(t, err)
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}
	require.NoError(t, rows.Err())
	require.Equal(t, 3, count, "expected one representative table from user/storage/message")
}
