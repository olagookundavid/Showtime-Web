package services

import (
	"fmt"
	"log"
	"sync"

	"github.com/panjf2000/ants/v2"
)

var (
	globalWorkerPool *ants.Pool
	poolOnce         sync.Once
)

// InitWorkerPool initializes the global worker pool with the specified capacity.
func InitWorkerPool(capacity int) error {
	var err error
	poolOnce.Do(func() {
		globalWorkerPool, err = ants.NewPool(capacity)
	})
	if err != nil {
		return fmt.Errorf("failed to initialize worker pool: %w", err)
	}
	log.Printf("Worker pool initialized with capacity: %d", capacity)
	return nil
}

// GetWorkerPool returns the global worker pool instance.
func GetWorkerPool() *ants.Pool {
	if globalWorkerPool == nil {
		log.Println("[WARNING] Worker pool accessed before initialization. Initializing with default capacity 1000.")
		_ = InitWorkerPool(1000)
	}
	return globalWorkerPool
}

// SubmitJob submits a function to the global worker pool.
func SubmitJob(job func()) error {
	return GetWorkerPool().Submit(job)
}

// CloseWorkerPool shuts down the global worker pool.
func CloseWorkerPool() {
	if globalWorkerPool != nil {
		globalWorkerPool.Release()
		log.Println("Worker pool released.")
	}
}
