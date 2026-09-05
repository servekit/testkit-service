package main

import (
	"fmt"

	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/logging"

	licenseservice "github.com/servekit/license-service/pkg"
	messageservice "github.com/servekit/message-service/pkg"
	storageservice "github.com/servekit/storage-service/pkg"
	telemetryservice "github.com/servekit/telemetry-service/pkg"
	"github.com/servekit/testkit-service/pkg/config"
	userservice "github.com/servekit/user-service/pkg"

	"gorm.io/gorm"
)

// runMigrate loads config and applies the current schema of every embedded
// DB-bearing downstream onto the shared parent database. Operators (or CI) run
// this before bringing up the server, e.g. `docker run <image> migrate` or
// `./testkit-service migrate`.
//
// Each downstream's pkg.Migrate applies that downstream's AutoMigrate onto the
// injected db — the standard entry point each *-service exposes to embedders.
// testkit owns no tables yet (see runMigration below).
func runMigrate() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	logging.Setup(cfg.Log)

	db, err := dbx.New(cfg.Database)
	if err != nil {
		return fmt.Errorf("init database: %w", err)
	}

	return runMigration(db)
}

// runMigration migrates all embedded services' tables onto the shared db in a
// single process. gid-service has no DB and is skipped.
//
// The three services use no foreign keys (only UNIQUE/index, per their
// conventions), so there are no cross-service dependencies and the call order
// is irrelevant.
//
// testkit-service owns no tables in P1 (scaffolded without --db); when it
// gains its own tables (e.g. audit/aggregate), append its own
// models.AllModels() migration here.
func runMigration(db *gorm.DB) error {
	for _, m := range []func(*gorm.DB) error{
		userservice.Migrate,
		storageservice.Migrate,
		messageservice.Migrate,
		licenseservice.Migrate,
		telemetryservice.Migrate,
	} {
		if err := m(db); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
