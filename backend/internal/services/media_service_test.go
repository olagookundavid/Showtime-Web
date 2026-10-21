package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"

	"github.com/google/uuid"
)

type mockMediaRepo struct {
	files map[string]*domain.MediaFile
}

func newMockMediaRepo() *mockMediaRepo {
	return &mockMediaRepo{files: map[string]*domain.MediaFile{}}
}

func (m *mockMediaRepo) List(context.Context) ([]*domain.MediaFile, error) {
	var out []*domain.MediaFile
	for _, f := range m.files {
		out = append(out, f)
	}
	return out, nil
}
func (m *mockMediaRepo) FindByID(_ context.Context, id string) (*domain.MediaFile, error) {
	return m.files[id], nil
}
func (m *mockMediaRepo) SlugExists(_ context.Context, slug string) (bool, error) {
	for _, f := range m.files {
		if f.Slug == slug {
			return true, nil
		}
	}
	return false, nil
}
func (m *mockMediaRepo) Create(ctx context.Context, f *domain.MediaFile) error {
	if taken, _ := m.SlugExists(ctx, f.Slug); taken {
		return ports.ErrMediaSlugConflict
	}
	f.ID = uuid.New().String()
	f.CreatedAt, f.UpdatedAt = time.Now(), time.Now()
	m.files[f.ID] = f
	return nil
}
func (m *mockMediaRepo) UpdateTitle(_ context.Context, id, title string) error {
	m.files[id].Title = title
	return nil
}
func (m *mockMediaRepo) UpdateFile(_ context.Context, id, filename, contentType string, size int64) error {
	f := m.files[id]
	f.OriginalFilename, f.ContentType, f.SizeBytes = filename, contentType, size
	return nil
}
func (m *mockMediaRepo) Delete(_ context.Context, id string) error {
	delete(m.files, id)
	return nil
}

type mockObject struct {
	size int64
	meta ports.ObjectMeta
}

type mockStorage struct {
	objects map[string]mockObject
	copyErr error
}

func newMockStorage() *mockStorage { return &mockStorage{objects: map[string]mockObject{}} }

func (m *mockStorage) put(key, contentType string, size int64) {
	m.objects[key] = mockObject{size: size, meta: ports.ObjectMeta{ContentType: contentType}}
}
func (m *mockStorage) GeneratePresignedPutURL(context.Context, string, string) (string, string, string, error) {
	return "", "", "", nil
}
func (m *mockStorage) DeleteObject(context.Context, string) error { return nil }
func (m *mockStorage) DeleteObjectByKey(_ context.Context, key string) error {
	delete(m.objects, key)
	return nil
}
func (m *mockStorage) ListObjects(context.Context) ([]ports.StorageObject, error) { return nil, nil }
func (m *mockStorage) ObjectKeyFromURL(string) (string, bool)                     { return "", false }
func (m *mockStorage) PresignPutKey(_ context.Context, key, _ string, _ int64) (string, error) {
	return "https://upload.example/" + key, nil
}
func (m *mockStorage) HeadObject(_ context.Context, key string) (int64, string, bool, error) {
	o, ok := m.objects[key]
	return o.size, o.meta.ContentType, ok, nil
}
func (m *mockStorage) CopyObject(_ context.Context, src, dst string, meta ports.ObjectMeta) error {
	if m.copyErr != nil {
		return m.copyErr
	}
	o := m.objects[src]
	o.meta = meta
	m.objects[dst] = o
	return nil
}
func (m *mockStorage) PublicURL(key string) string { return "https://cdn.example/" + key }

func newTestMediaService() (*MediaService, *mockMediaRepo, *mockStorage) {
	repo, store := newMockMediaRepo(), newMockStorage()
	return &MediaService{repo: repo, storage: store}, repo, store
}

func isMediaValidation(err error) bool {
	var v appErrors.MediaValidationError
	return errors.As(err, &v)
}

// uploadAs runs presign + the browser's PUT, returning the temp key.
func uploadAs(t *testing.T, s *MediaService, store *mockStorage, req dto.PresignMediaRequest) string {
	t.Helper()
	resp, err := s.Presign(context.Background(), req)
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	store.put(resp.UploadKey, req.ContentType, req.Size)
	return resp.UploadKey
}

func TestMediaPresignRejectsBadInput(t *testing.T) {
	s, _, _ := newTestMediaService()
	ctx := context.Background()
	cases := map[string]dto.PresignMediaRequest{
		"svg":        {Slug: "logo", Filename: "logo.svg", ContentType: "image/svg+xml", Size: 100},
		"html":       {Slug: "page", Filename: "a.html", ContentType: "text/html", Size: 100},
		"empty":      {Slug: "rulebook", Filename: "r.pdf", ContentType: "application/pdf", Size: 0},
		"pdf 26MB":   {Slug: "rulebook", Filename: "r.pdf", ContentType: "application/pdf", Size: 26 * mb},
		"image 11MB": {Slug: "poster", Filename: "p.png", ContentType: "image/png", Size: 11 * mb},
		"bad slug":   {Slug: "Rule Book", Filename: "r.pdf", ContentType: "application/pdf", Size: 100},
		"slug dash":  {Slug: "-rulebook", Filename: "r.pdf", ContentType: "application/pdf", Size: 100},
		"slug short": {Slug: "r", Filename: "r.pdf", ContentType: "application/pdf", Size: 100},
	}
	for name, req := range cases {
		if _, err := s.Presign(ctx, req); !isMediaValidation(err) {
			t.Errorf("%s: want a validation error, got %v", name, err)
		}
	}
}

func TestMediaCreateServesFromFixedKey(t *testing.T) {
	s, repo, store := newTestMediaService()
	ctx := context.Background()
	key := uploadAs(t, s, store, dto.PresignMediaRequest{Slug: "rulebook", Filename: "Rule Book.pdf", ContentType: "application/pdf", Size: 5000})
	if !strings.HasPrefix(key, mediaUploadPrefix) {
		t.Fatalf("upload key %q should be under %s", key, mediaUploadPrefix)
	}

	f, err := s.Create(ctx, uuid.New().String(), dto.CreateMediaRequest{Slug: "rulebook", Title: "Rule Book", Filename: "Rule Book.pdf", UploadKey: key})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if f.ObjectKey != "files/rulebook.pdf" || f.URL != "https://cdn.example/files/rulebook.pdf" {
		t.Fatalf("got key %q url %q", f.ObjectKey, f.URL)
	}
	if f.UploadedBy == nil || f.SizeBytes != 5000 {
		t.Errorf("uploader/size not recorded: %+v", f)
	}
	obj, ok := store.objects["files/rulebook.pdf"]
	if !ok {
		t.Fatal("file wasn't copied to its fixed key")
	}
	if obj.meta.CacheControl != mediaCacheControl || !strings.HasPrefix(obj.meta.ContentDisposition, "inline;") {
		t.Errorf("wrong headers: %+v", obj.meta)
	}
	if _, still := store.objects[key]; still {
		t.Error("temp upload wasn't removed")
	}
	if len(repo.files) != 1 {
		t.Errorf("want 1 row, got %d", len(repo.files))
	}

	// The slug is now taken, for presign and create alike.
	if _, err := s.Presign(ctx, dto.PresignMediaRequest{Slug: "rulebook", Filename: "x.pdf", ContentType: "application/pdf", Size: 10}); !errors.Is(err, appErrors.ErrMediaSlugTaken) {
		t.Errorf("presign with a taken slug: want ErrMediaSlugTaken, got %v", err)
	}
}

func TestMediaCreateDocumentsDownload(t *testing.T) {
	s, _, store := newTestMediaService()
	docx := "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	key := uploadAs(t, s, store, dto.PresignMediaRequest{Slug: "minutes", Filename: "minutes.docx", ContentType: docx, Size: 100})
	if _, err := s.Create(context.Background(), "", dto.CreateMediaRequest{Slug: "minutes", Title: "Minutes", Filename: "minutes.docx", UploadKey: key}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if d := store.objects["files/minutes.docx"].meta.ContentDisposition; !strings.HasPrefix(d, "attachment;") {
		t.Errorf("documents should download, got %q", d)
	}
}

func TestMediaCreateGuards(t *testing.T) {
	s, repo, store := newTestMediaService()
	ctx := context.Background()

	// Only temp uploads can be copied into the library.
	store.put("players/someone.webp", "image/webp", 100)
	for _, key := range []string{"players/someone.webp", "uploads-tmp/../players/someone.webp", "files/other.pdf"} {
		_, err := s.Create(ctx, "", dto.CreateMediaRequest{Slug: "stolen", Title: "x", UploadKey: key})
		if !isMediaValidation(err) {
			t.Errorf("key %q: want a validation error, got %v", key, err)
		}
	}

	// An upload that never arrived.
	if _, err := s.Create(ctx, "", dto.CreateMediaRequest{Slug: "ghost", Title: "x", UploadKey: "uploads-tmp/nothing.pdf"}); !errors.Is(err, appErrors.ErrMediaUploadMissing) {
		t.Errorf("missing upload: want ErrMediaUploadMissing, got %v", err)
	}

	// A failed copy takes the row back out, so the slug is free to retry.
	key := uploadAs(t, s, store, dto.PresignMediaRequest{Slug: "retry", Filename: "r.pdf", ContentType: "application/pdf", Size: 10})
	store.copyErr = errors.New("r2 down")
	if _, err := s.Create(ctx, "", dto.CreateMediaRequest{Slug: "retry", Title: "x", UploadKey: key}); err == nil {
		t.Fatal("want the copy failure surfaced")
	}
	if len(repo.files) != 0 {
		t.Errorf("row left behind after a failed copy")
	}
}

func TestMediaReplaceKeepsURL(t *testing.T) {
	s, _, store := newTestMediaService()
	ctx := context.Background()
	key := uploadAs(t, s, store, dto.PresignMediaRequest{Slug: "rulebook", Filename: "old.pdf", ContentType: "application/pdf", Size: 100})
	f, err := s.Create(ctx, "", dto.CreateMediaRequest{Slug: "rulebook", Title: "Rule Book", Filename: "old.pdf", UploadKey: key})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// A different kind of file can't replace it — that would change the URL.
	if _, err := s.Presign(ctx, dto.PresignMediaRequest{FileID: f.ID, Filename: "new.png", ContentType: "image/png", Size: 100}); !isMediaValidation(err) {
		t.Errorf("replace PDF with PNG at presign: want a validation error, got %v", err)
	}
	pngKey := "uploads-tmp/sneaky.png"
	store.put(pngKey, "image/png", 100)
	if _, err := s.Replace(ctx, f.ID, dto.ReplaceMediaFileRequest{UploadKey: pngKey}); !isMediaValidation(err) {
		t.Errorf("replace PDF with PNG: want a validation error, got %v", err)
	}

	newKey := uploadAs(t, s, store, dto.PresignMediaRequest{FileID: f.ID, Filename: "new.pdf", ContentType: "application/pdf", Size: 999})
	got, err := s.Replace(ctx, f.ID, dto.ReplaceMediaFileRequest{Filename: "new.pdf", UploadKey: newKey})
	if err != nil {
		t.Fatalf("replace: %v", err)
	}
	if got.URL != f.URL || got.ObjectKey != "files/rulebook.pdf" {
		t.Errorf("URL changed on replace: %q -> %q", f.URL, got.URL)
	}
	if got.SizeBytes != 999 || store.objects["files/rulebook.pdf"].size != 999 {
		t.Errorf("replacement not stored: row %d, object %d", got.SizeBytes, store.objects["files/rulebook.pdf"].size)
	}
}

func TestMediaUnknownIDs(t *testing.T) {
	s, _, _ := newTestMediaService()
	ctx := context.Background()
	for _, id := range []string{"not-a-uuid", uuid.New().String()} {
		if err := s.Delete(ctx, id); !errors.Is(err, appErrors.ErrMediaFileNotFound) {
			t.Errorf("delete %q: want ErrMediaFileNotFound, got %v", id, err)
		}
	}
}

func TestMediaDeleteRemovesObjectAndRow(t *testing.T) {
	s, repo, store := newTestMediaService()
	ctx := context.Background()
	key := uploadAs(t, s, store, dto.PresignMediaRequest{Slug: "poster", Filename: "p.jpg", ContentType: "image/jpeg", Size: 10})
	f, err := s.Create(ctx, "", dto.CreateMediaRequest{Slug: "poster", Title: "Poster", UploadKey: key})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := s.Delete(ctx, f.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok := store.objects[f.ObjectKey]; ok || len(repo.files) != 0 {
		t.Error("object or row survived delete")
	}
}

func TestContentDispositionEscapesFilename(t *testing.T) {
	got := contentDisposition(mediaTypes["application/pdf"], `Règles "2026".pdf`, "rulebook")
	if strings.Contains(got, `"2026"`) || !strings.Contains(got, "filename*=UTF-8''R%C3%A8gles") {
		t.Errorf("filename not escaped: %s", got)
	}
}

func TestGCProtectedPrefixes(t *testing.T) {
	for key, want := range map[string]bool{
		"files/rulebook.pdf":       true,
		"pdfs/bye_laws.pdf":        true,
		"badges/game-mvp.png":      true,
		"uploads-tmp/abc.pdf":      false,
		"players/abc.webp":         false,
		"filesystem/not-ours.webp": false,
	} {
		if got := isProtectedKey(key); got != want {
			t.Errorf("isProtectedKey(%q) = %v, want %v", key, got, want)
		}
	}
}
