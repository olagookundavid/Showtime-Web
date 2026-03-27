package ports

import "context"

type StorageService interface {
	GeneratePresignedPutURL(ctx context.Context, folder, contentType string) (uploadURL, objectKey, publicURL string, err error)
	DeleteObject(ctx context.Context, objectKey string) error
}
