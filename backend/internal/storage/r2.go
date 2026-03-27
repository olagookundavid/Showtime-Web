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
	if !strings.HasPrefix(imageURL, s.publicURL) {
		return nil
	}

	objectKey := strings.TrimPrefix(imageURL, s.publicURL)
	objectKey = strings.TrimPrefix(objectKey, "/")

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", objectKey, err)
	}

	return nil
}
