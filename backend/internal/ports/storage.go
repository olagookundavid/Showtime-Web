package ports

import (
	"context"
	"time"
)

// StorageObject is a single object listed from the bucket.
type StorageObject struct {
	Key          string
	LastModified time.Time
}

type StorageService interface {
	GeneratePresignedPutURL(ctx context.Context, folder, contentType string) (uploadURL, objectKey, publicURL string, err error)
	DeleteObject(ctx context.Context, objectKey string) error
	// DeleteObjectByKey deletes by raw object key (used by the GC sweep, which
	// works in keys rather than public URLs).
	DeleteObjectByKey(ctx context.Context, key string) error
	// ListObjects returns every object in the bucket (paginated internally).
	ListObjects(ctx context.Context) ([]StorageObject, error)
	// ObjectKeyFromURL maps a stored public URL back to its object key. ok is
	// false when the URL is not one of ours (external link), so callers can
	// safely skip it.
	ObjectKeyFromURL(url string) (key string, ok bool)
}
