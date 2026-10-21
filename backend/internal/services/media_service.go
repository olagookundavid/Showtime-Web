package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"regexp"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"

	"github.com/google/uuid"
)

const (
	// mediaKeyPrefix is where library files live. Their keys never change, so the
	// GC sweep never touches this prefix (see protectedPrefixes).
	mediaKeyPrefix = "files/"
	// mediaUploadPrefix holds uploads until they are confirmed and copied into
	// place. Abandoned ones are swept by the GC like any other orphan.
	mediaUploadPrefix = "uploads-tmp/"
	// A replaced file reaches visitors within five minutes.
	mediaCacheControl = "public, max-age=300"

	maxMediaTitleLen    = 160
	maxMediaFilenameLen = 255
	mb                  = 1 << 20
)

var mediaSlugRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// mediaType is what the library accepts for one content type. SVG is left out on
// purpose: it can carry script that runs when opened directly on the CDN.
type mediaType struct {
	ext     string
	maxSize int64
	// inline files open in the browser (PDFs, images); the rest download.
	inline bool
}

var mediaTypes = map[string]mediaType{
	"application/pdf": {"pdf", 25 * mb, true},
	"image/jpeg":      {"jpg", 10 * mb, true},
	"image/png":       {"png", 10 * mb, true},
	"image/webp":      {"webp", 10 * mb, true},
	"image/gif":       {"gif", 10 * mb, true},
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   {"docx", 25 * mb, false},
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         {"xlsx", 25 * mb, false},
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": {"pptx", 25 * mb, false},
	"text/csv": {"csv", 25 * mb, false},
}

type IMediaService interface {
	List(ctx context.Context) ([]*domain.MediaFile, error)
	// Presign hands out a temporary upload slot after checking the file is
	// allowed (and, for a new file, that its slug is free).
	Presign(ctx context.Context, req dto.PresignMediaRequest) (*dto.PresignMediaResponse, error)
	Create(ctx context.Context, userID string, req dto.CreateMediaRequest) (*domain.MediaFile, error)
	Replace(ctx context.Context, id string, req dto.ReplaceMediaFileRequest) (*domain.MediaFile, error)
	UpdateTitle(ctx context.Context, id string, req dto.UpdateMediaRequest) error
	Delete(ctx context.Context, id string) error
}

type MediaService struct {
	repo    ports.MediaRepository
	storage ports.StorageService
}

func NewMediaService(repo ports.MediaRepository, storage ports.StorageService) IMediaService {
	return &MediaService{repo: repo, storage: storage}
}

func mediaInvalid(msg string) error { return appErrors.MediaValidationError(msg) }

// lookupMediaType returns the rules for a content type, or a worded error.
func lookupMediaType(contentType string) (mediaType, error) {
	t, ok := mediaTypes[strings.ToLower(strings.TrimSpace(contentType))]
	if !ok {
		return mediaType{}, mediaInvalid("That file type isn't allowed. Upload a PDF, an image (JPEG, PNG, WebP, GIF), or a Word, Excel, PowerPoint or CSV file.")
	}
	return t, nil
}

func checkMediaSize(t mediaType, size int64) error {
	if size <= 0 {
		return mediaInvalid("The file is empty.")
	}
	if size > t.maxSize {
		return mediaInvalid(fmt.Sprintf("The file is too large. %s files can be up to %d MB.", strings.ToUpper(t.ext), t.maxSize/mb))
	}
	return nil
}

func validateMediaSlug(slug string) error {
	if len(slug) < 2 || len(slug) > 80 || !mediaSlugRe.MatchString(slug) {
		return mediaInvalid("The file name in the link must be 2–80 lowercase letters, numbers and single dashes, e.g. rulebook-2026.")
	}
	return nil
}

// mediaKey is the fixed key a library file is served from.
func mediaKey(slug, ext string) string { return mediaKeyPrefix + slug + "." + ext }

// checkUploadKey makes sure create/replace only ever copies from the temporary
// upload area, never from an arbitrary object in the bucket.
func checkUploadKey(key string) error {
	if !strings.HasPrefix(key, mediaUploadPrefix) || strings.Contains(key, "..") || strings.ContainsAny(key, "\\?#") {
		return mediaInvalid("That upload isn't valid. Upload the file again.")
	}
	return nil
}

func cleanFilename(name string) string {
	name = strings.TrimSpace(path.Base(strings.ReplaceAll(name, "\\", "/")))
	if name == "." || name == "/" {
		return ""
	}
	if len(name) > maxMediaFilenameLen {
		name = name[:maxMediaFilenameLen]
	}
	return name
}

// contentDisposition says whether the browser opens or downloads the file, and
// the name it saves it under. The plain filename is an ASCII fallback; filename*
// carries the exact name for browsers that read it (all current ones).
func contentDisposition(t mediaType, filename, slug string) string {
	kind := "attachment"
	if t.inline {
		kind = "inline"
	}
	if filename == "" {
		filename = slug + "." + t.ext
	}
	ascii := strings.Map(func(r rune) rune {
		if r < 0x20 || r > 0x7e || r == '"' || r == '\\' {
			return '_'
		}
		return r
	}, filename)
	return fmt.Sprintf(`%s; filename="%s"; filename*=UTF-8''%s`, kind, ascii, url.PathEscape(filename))
}

func (s *MediaService) find(ctx context.Context, id string) (*domain.MediaFile, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, appErrors.ErrMediaFileNotFound
	}
	f, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, appErrors.ErrMediaFileNotFound
	}
	return f, nil
}

// checkUpload confirms the temporary upload is there and is an allowed type and
// size. Type and size were signed into the upload URL, so this is a second check
// on what actually landed.
func (s *MediaService) checkUpload(ctx context.Context, key string) (mediaType, string, int64, error) {
	if err := checkUploadKey(key); err != nil {
		return mediaType{}, "", 0, err
	}
	size, contentType, found, err := s.storage.HeadObject(ctx, key)
	if err != nil {
		return mediaType{}, "", 0, err
	}
	if !found {
		return mediaType{}, "", 0, appErrors.ErrMediaUploadMissing
	}
	t, err := lookupMediaType(contentType)
	if err != nil {
		return mediaType{}, "", 0, err
	}
	if err := checkMediaSize(t, size); err != nil {
		return mediaType{}, "", 0, err
	}
	return t, strings.ToLower(contentType), size, nil
}

func (s *MediaService) List(ctx context.Context) ([]*domain.MediaFile, error) {
	return s.repo.List(ctx)
}

func (s *MediaService) Presign(ctx context.Context, req dto.PresignMediaRequest) (*dto.PresignMediaResponse, error) {
	t, err := lookupMediaType(req.ContentType)
	if err != nil {
		return nil, err
	}
	if err := checkMediaSize(t, req.Size); err != nil {
		return nil, err
	}

	if req.FileID != "" {
		existing, err := s.find(ctx, req.FileID)
		if err != nil {
			return nil, err
		}
		if err := checkSameExtension(existing, t); err != nil {
			return nil, err
		}
	} else {
		slug := strings.TrimSpace(req.Slug)
		if err := validateMediaSlug(slug); err != nil {
			return nil, err
		}
		taken, err := s.repo.SlugExists(ctx, slug)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, appErrors.ErrMediaSlugTaken
		}
	}

	key := mediaUploadPrefix + uuid.New().String() + "." + t.ext
	uploadURL, err := s.storage.PresignPutKey(ctx, key, strings.ToLower(strings.TrimSpace(req.ContentType)), req.Size)
	if err != nil {
		return nil, err
	}
	return &dto.PresignMediaResponse{UploadURL: uploadURL, UploadKey: key}, nil
}

// checkSameExtension keeps a replacement at the same key, so its URL doesn't change.
func checkSameExtension(existing *domain.MediaFile, t mediaType) error {
	if path.Ext(existing.ObjectKey) != "."+t.ext {
		return mediaInvalid(fmt.Sprintf(
			"A replacement must be the same kind of file (%s), so the link keeps working. To use a different kind, upload it as a new file.",
			strings.ToUpper(strings.TrimPrefix(path.Ext(existing.ObjectKey), "."))))
	}
	return nil
}

func (s *MediaService) Create(ctx context.Context, userID string, req dto.CreateMediaRequest) (*domain.MediaFile, error) {
	slug := strings.TrimSpace(req.Slug)
	if err := validateMediaSlug(slug); err != nil {
		return nil, err
	}
	title := strings.TrimSpace(req.Title)
	if title == "" || len(title) > maxMediaTitleLen {
		return nil, mediaInvalid(fmt.Sprintf("Give the file a title of up to %d characters.", maxMediaTitleLen))
	}
	t, contentType, size, err := s.checkUpload(ctx, req.UploadKey)
	if err != nil {
		return nil, err
	}

	filename := cleanFilename(req.Filename)
	key := mediaKey(slug, t.ext)
	f := &domain.MediaFile{
		Slug:             slug,
		ObjectKey:        key,
		URL:              s.storage.PublicURL(key),
		Title:            title,
		OriginalFilename: filename,
		ContentType:      contentType,
		SizeBytes:        size,
	}
	if _, err := uuid.Parse(userID); err == nil {
		f.UploadedBy = &userID
	}

	// The row goes in first: its unique slug is what stops two uploads racing for
	// the same key. If the copy then fails, the row is taken back out.
	if err := s.repo.Create(ctx, f); err != nil {
		if errors.Is(err, ports.ErrMediaSlugConflict) {
			return nil, appErrors.ErrMediaSlugTaken
		}
		return nil, err
	}
	meta := ports.ObjectMeta{ContentType: contentType, CacheControl: mediaCacheControl, ContentDisposition: contentDisposition(t, filename, slug)}
	if err := s.storage.CopyObject(ctx, req.UploadKey, key, meta); err != nil {
		_ = s.repo.Delete(ctx, f.ID)
		return nil, err
	}
	// Leftover temp uploads are swept by the GC, so a failure here is harmless.
	_ = s.storage.DeleteObjectByKey(ctx, req.UploadKey)
	return f, nil
}

func (s *MediaService) Replace(ctx context.Context, id string, req dto.ReplaceMediaFileRequest) (*domain.MediaFile, error) {
	f, err := s.find(ctx, id)
	if err != nil {
		return nil, err
	}
	t, contentType, size, err := s.checkUpload(ctx, req.UploadKey)
	if err != nil {
		return nil, err
	}
	if err := checkSameExtension(f, t); err != nil {
		return nil, err
	}

	filename := cleanFilename(req.Filename)
	meta := ports.ObjectMeta{ContentType: contentType, CacheControl: mediaCacheControl, ContentDisposition: contentDisposition(t, filename, f.Slug)}
	if err := s.storage.CopyObject(ctx, req.UploadKey, f.ObjectKey, meta); err != nil {
		return nil, err
	}
	_ = s.storage.DeleteObjectByKey(ctx, req.UploadKey)

	if err := s.repo.UpdateFile(ctx, f.ID, filename, contentType, size); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, f.ID)
}

func (s *MediaService) UpdateTitle(ctx context.Context, id string, req dto.UpdateMediaRequest) error {
	f, err := s.find(ctx, id)
	if err != nil {
		return err
	}
	title := strings.TrimSpace(req.Title)
	if title == "" || len(title) > maxMediaTitleLen {
		return mediaInvalid(fmt.Sprintf("Give the file a title of up to %d characters.", maxMediaTitleLen))
	}
	return s.repo.UpdateTitle(ctx, f.ID, title)
}

// Delete removes the file from storage, then its record. If storage fails the
// record stays, so the admin can see the file is still there and try again.
func (s *MediaService) Delete(ctx context.Context, id string) error {
	f, err := s.find(ctx, id)
	if err != nil {
		return err
	}
	if err := s.storage.DeleteObjectByKey(ctx, f.ObjectKey); err != nil {
		return err
	}
	return s.repo.Delete(ctx, f.ID)
}
