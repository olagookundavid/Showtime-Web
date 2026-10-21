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

// ObjectMeta is the headers an object is served with.
type ObjectMeta struct {
	ContentType        string
	CacheControl       string
	ContentDisposition string
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

	// PresignPutKey presigns a PUT to an exact key. Content type and size are
	// signed, so the upload is rejected unless it matches both.
	PresignPutKey(ctx context.Context, key, contentType string, size int64) (uploadURL string, err error)
	// HeadObject reports an object's size and type. found is false when it doesn't exist.
	HeadObject(ctx context.Context, key string) (size int64, contentType string, found bool, err error)
	// CopyObject copies src to dst inside the bucket, replacing the headers it is served with.
	CopyObject(ctx context.Context, srcKey, dstKey string, meta ObjectMeta) error
	// PublicURL is the public CDN URL for a key.
	PublicURL(key string) string
}
