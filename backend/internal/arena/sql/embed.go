// Package arenasql holds Clubs Arena's database scripts. The backend never runs
// them: they are applied by hand on production, and by the Arena tests.
package arenasql

import "embed"

// Migrations are the numbered scripts, applied in file name order.
//
//go:embed migrations/*.sql
var Migrations embed.FS
