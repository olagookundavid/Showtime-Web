package main

import (
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	c, _ := pgxpool.ParseConfig("postgres://foo")
	c.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	fmt.Println("works")
}
