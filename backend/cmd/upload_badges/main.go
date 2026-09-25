package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load environment
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")
	_ = godotenv.Load("../.env")

	accountID := os.Getenv("R2_ACCOUNT_ID")
	accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	secretAccessKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucketName := os.Getenv("R2_BUCKET_NAME")
	publicURL := os.Getenv("R2_PUBLIC_URL")

	if accountID == "" || accessKeyID == "" || secretAccessKey == "" || bucketName == "" {
		log.Fatalf("Missing required R2 credentials in environment")
	}
	if publicURL == "" {
		publicURL = "https://cdn.sffl.football"
	}
	publicURL = strings.TrimSuffix(publicURL, "/")

	// 2. Initialize S3 client for Cloudflare R2
	r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL: fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID),
		}, nil
	})

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		log.Fatalf("Failed to load AWS/R2 config: %v", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	// 3. Find badge files in png-256
	candidates := []string{
		"png-256",
		"../png-256",
		"/Users/davidoh/Showtime/Showtime Web/png-256",
	}

	var badgeDir string
	for _, dir := range candidates {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			badgeDir = dir
			break
		}
	}

	if badgeDir == "" {
		log.Fatalf("Could not locate png-256 directory")
	}

	files, err := os.ReadDir(badgeDir)
	if err != nil {
		log.Fatalf("Failed to read badge directory %s: %v", badgeDir, err)
	}

	presignClient := s3.NewPresignClient(client)

	ctx := context.Background()
	uploadedCount := 0

	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(strings.ToLower(file.Name()), ".png") {
			continue
		}

		filePath := filepath.Join(badgeDir, file.Name())
		dataBytes, err := os.ReadFile(filePath)
		if err != nil {
			log.Fatalf("Failed to read file %s: %v", filePath, err)
		}

		objectKey := fmt.Sprintf("badges/%s", file.Name())
		contentType := "image/png"

		// Presign PUT object
		presignedReq, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(bucketName),
			Key:         aws.String(objectKey),
			ContentType: aws.String(contentType),
		}, func(opts *s3.PresignOptions) {
			opts.Expires = 15 * time.Minute
		})
		if err != nil {
			log.Fatalf("Failed to presign %s: %v", objectKey, err)
		}

		// Perform HTTP PUT
		req, err := http.NewRequestWithContext(ctx, "PUT", presignedReq.URL, bytes.NewReader(dataBytes))
		if err != nil {
			log.Fatalf("Failed to create HTTP request for %s: %v", objectKey, err)
		}
		req.Header.Set("Content-Type", contentType)

		resp, err := httpClient.Do(req)
		if err != nil {
			log.Fatalf("HTTP PUT failed for %s: %v", objectKey, err)
		}
		resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			log.Fatalf("Upload failed for %s with HTTP %d", objectKey, resp.StatusCode)
		}

		uploadedURL := fmt.Sprintf("%s/%s", publicURL, objectKey)
		fmt.Printf("✓ Uploaded: %-25s -> %s\n", file.Name(), uploadedURL)
		uploadedCount++
	}

	fmt.Printf("\n✨ Successfully uploaded %d official badge images to Cloudflare R2!\n", uploadedCount)
}
