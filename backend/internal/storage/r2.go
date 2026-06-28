package storage

import (
	"context"
	"fmt"
	"os"
	"showtime-backend/internal/ports"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type R2StorageService struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucketName    string
	publicURL     string
}

func NewR2StorageService() (ports.StorageService, error) {
	accountID := os.Getenv("R2_ACCOUNT_ID")
	accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	secretAccessKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucketName := os.Getenv("R2_BUCKET_NAME")
	publicURL := os.Getenv("R2_PUBLIC_URL")

	if accountID == "" || accessKeyID == "" || secretAccessKey == "" || bucketName == "" || publicURL == "" {
		return nil, fmt.Errorf("R2 environment variables are missing")
	}

	r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL: fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID),
		}, nil
	})

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load R2 config: %w", err)
	}

	client := s3.NewFromConfig(cfg)

	return &R2StorageService{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucketName:    bucketName,
		publicURL:     strings.TrimSuffix(publicURL, "/"),
	}, nil
}

func (s *R2StorageService) GeneratePresignedPutURL(ctx context.Context, folder, contentType string) (string, string, string, error) {
	// Generate a unique object key
	ext := "webp" // Default to webp since we compress to webp on frontend
	if strings.Contains(contentType, "/") {
		ext = strings.Split(contentType, "/")[1]
	}
	
	objectKey := fmt.Sprintf("%s/%s.%s", folder, uuid.New().String(), ext)

	request, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(objectKey),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 10 * time.Minute
	})
	if err != nil {
		return "", "", "", fmt.Errorf("failed to presign put object: %w", err)
	}

	publicURL := fmt.Sprintf("%s/%s", s.publicURL, objectKey)

	return request.URL, objectKey, publicURL, nil
}

func (s *R2StorageService) DeleteObject(ctx context.Context, imageURL string) error {
	if imageURL == "" {
		return nil
	}

	// Extract object key from public URL
	// If the URL doesn't start with our public URL, it's probably not our object
	objectKey, ok := s.ObjectKeyFromURL(imageURL)
	if !ok {
		return nil
	}

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", objectKey, err)
	}

	return nil
}

// DeleteObjectByKey removes an object by its raw key.
func (s *R2StorageService) DeleteObjectByKey(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", key, err)
	}
	return nil
}

// ObjectKeyFromURL maps one of our public URLs back to its object key. Returns
// ok=false for empty or external URLs (not under our public URL prefix).
func (s *R2StorageService) ObjectKeyFromURL(url string) (string, bool) {
	if url == "" || !strings.HasPrefix(url, s.publicURL) {
		return "", false
	}
	key := strings.TrimPrefix(url, s.publicURL)
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return "", false
	}
	return key, true
}

// ListObjects returns every object in the bucket, following pagination.
func (s *R2StorageService) ListObjects(ctx context.Context) ([]ports.StorageObject, error) {
	var objects []ports.StorageObject
	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucketName),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list bucket objects: %w", err)
		}
		for _, obj := range page.Contents {
			if obj.Key == nil {
				continue
			}
			var modified time.Time
			if obj.LastModified != nil {
				modified = *obj.LastModified
			}
			objects = append(objects, ports.StorageObject{
				Key:          *obj.Key,
				LastModified: modified,
			})
		}
	}
	return objects, nil
}
