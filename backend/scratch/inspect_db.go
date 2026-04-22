package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		log.Fatal("DB_URL is empty")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	// 1. Check current date in DB
	var dbDate string
	err = pool.QueryRow(context.Background(), "SELECT CURRENT_DATE").Scan(&dbDate)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("DB CURRENT_DATE: %s\n", dbDate)

	// 2. Check event days
	fmt.Println("\n--- Event Days ---")
	rows, _ := pool.Query(context.Background(), "SELECT id, title, date FROM event_days")
	for rows.Next() {
		var id, title, date string
		rows.Scan(&id, &title, &date)
		fmt.Printf("ID: %s, Title: %s, Date: %s\n", id, title, date)
	}

	// 3. Check some recent tickets
	fmt.Println("\n--- Recent Tickets ---")
	rows, _ = pool.Query(context.Background(), "SELECT id, email, status, ticket_code, event_day_id, created_at FROM tickets ORDER BY created_at DESC LIMIT 5")
	for rows.Next() {
		var id, email, status, code, edID, createdAt string
		rows.Scan(&id, &email, &status, &code, &edID, &createdAt)
		fmt.Printf("ID: %s, Email: %s, Status: %s, Code: %s, ED_ID: %s, Created: %s\n", id, email, status, code, edID, createdAt)
	}
}
