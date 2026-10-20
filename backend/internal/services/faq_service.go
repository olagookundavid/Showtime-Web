package services

import (
	"context"
	"regexp"
	"strconv"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/richtext"

	"github.com/google/uuid"
)

const (
	maxFAQNameLen     = 120
	maxFAQPathLen     = 200
	maxFAQQuestionLen = 300
	maxFAQReorderIDs  = 500
)

var (
	faqKeyRe  = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	faqIconRe = regexp.MustCompile(`^[a-z0-9-]{0,30}$`)
)

type IFAQService interface {
	// Public: active questions only, empty categories dropped.
	GetPublicPage(ctx context.Context, key string) (*dto.FAQPageResponse, error)

	// Admin: everything, including hidden questions.
	ListPages(ctx context.Context) ([]dto.FAQPageSummaryResponse, error)
	GetAdminPage(ctx context.Context, key string) (*dto.FAQPageResponse, error)
	CreatePage(ctx context.Context, req dto.CreateFAQPageRequest) (*dto.FAQPageSummaryResponse, error)
	UpdatePage(ctx context.Context, key string, req dto.UpdateFAQPageRequest) error
	DeletePage(ctx context.Context, key string) error

	CreateCategory(ctx context.Context, pageKey string, req dto.CreateFAQCategoryRequest) (*dto.FAQCategoryResponse, error)
	UpdateCategory(ctx context.Context, id string, req dto.UpdateFAQCategoryRequest) error
	DeleteCategory(ctx context.Context, id string) error

	CreateItem(ctx context.Context, pageKey string, req dto.CreateFAQItemRequest) (*dto.FAQItemResponse, error)
	UpdateItem(ctx context.Context, id string, req dto.UpdateFAQItemRequest) error
	DeleteItem(ctx context.Context, id string) error

	Reorder(ctx context.Context, req dto.ReorderFAQRequest) error
}

type FAQService struct {
	repo ports.FAQRepository
}

func NewFAQService(repo ports.FAQRepository) IFAQService {
	return &FAQService{repo: repo}
}

func faqInvalid(msg string) error { return appErrors.FAQValidationError(msg) }

func faqItemToResponse(i *domain.FAQItem) dto.FAQItemResponse {
	return dto.FAQItemResponse{
		ID:           i.ID,
		CategoryID:   i.CategoryID,
		Question:     i.Question,
		Answer:       i.Answer,
		DisplayOrder: i.DisplayOrder,
		IsActive:     i.IsActive,
	}
}

func (s *FAQService) loadPage(ctx context.Context, key string, activeOnly bool) (*dto.FAQPageResponse, error) {
	page, err := s.repo.FindPage(ctx, key)
	if err != nil {
		return nil, err
	}
	if page == nil {
		return nil, appErrors.ErrFAQPageNotFound
	}
	cats, err := s.repo.ListCategories(ctx, key)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, key, activeOnly)
	if err != nil {
		return nil, err
	}

	resp := &dto.FAQPageResponse{
		Key:         page.Key,
		Name:        page.Name,
		Path:        page.Path,
		Description: page.Description,
		Categories:  []dto.FAQCategoryResponse{},
		FAQs:        []dto.FAQItemResponse{},
	}

	byCategory := make(map[string][]dto.FAQItemResponse, len(cats))
	for _, i := range items {
		r := faqItemToResponse(i)
		if i.CategoryID == nil {
			resp.FAQs = append(resp.FAQs, r)
			continue
		}
		byCategory[*i.CategoryID] = append(byCategory[*i.CategoryID], r)
	}
	for _, c := range cats {
		faqs := byCategory[c.ID]
		if faqs == nil {
			// A category with nothing to show is noise on the public page; the
			// admin still needs to see it to fill it.
			if activeOnly {
				continue
			}
			faqs = []dto.FAQItemResponse{}
		}
		resp.Categories = append(resp.Categories, dto.FAQCategoryResponse{
			ID: c.ID, Slug: c.Slug, Title: c.Title, Icon: c.Icon, DisplayOrder: c.DisplayOrder, FAQs: faqs,
		})
	}
	return resp, nil
}

func (s *FAQService) GetPublicPage(ctx context.Context, key string) (*dto.FAQPageResponse, error) {
	return s.loadPage(ctx, key, true)
}

func (s *FAQService) GetAdminPage(ctx context.Context, key string) (*dto.FAQPageResponse, error) {
	return s.loadPage(ctx, key, false)
}

func (s *FAQService) ListPages(ctx context.Context) ([]dto.FAQPageSummaryResponse, error) {
	pages, err := s.repo.ListPages(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.FAQPageSummaryResponse, 0, len(pages))
	for _, p := range pages {
		out = append(out, dto.FAQPageSummaryResponse{
			Key: p.Key, Name: p.Name, Path: p.Path, Description: p.Description,
			CategoryCount: p.CategoryCount, ItemCount: p.ItemCount,
		})
	}
	return out, nil
}

// cleanPageFields trims and checks the fields shared by create and update.
func cleanPageFields(name, path, description string) (string, string, string, error) {
	name, path, description = strings.TrimSpace(name), strings.TrimSpace(path), strings.TrimSpace(description)
	if name == "" {
		return "", "", "", faqInvalid("a page needs a name")
	}
	if len(name) > maxFAQNameLen {
		return "", "", "", faqInvalid("the page name is too long")
	}
	if len(path) > maxFAQPathLen {
		return "", "", "", faqInvalid("the page path is too long")
	}
	return name, path, description, nil
}

func (s *FAQService) CreatePage(ctx context.Context, req dto.CreateFAQPageRequest) (*dto.FAQPageSummaryResponse, error) {
	key := strings.ToLower(strings.TrimSpace(req.Key))
	if len(key) > 60 || !faqKeyRe.MatchString(key) {
		return nil, faqInvalid("the key can only use lowercase letters, numbers and single dashes, e.g. store-faq")
	}
	name, path, description, err := cleanPageFields(req.Name, req.Path, req.Description)
	if err != nil {
		return nil, err
	}
	existing, err := s.repo.FindPage(ctx, key)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, appErrors.ErrFAQPageExists
	}

	page := &domain.FAQPage{Key: key, Name: name, Path: path, Description: description}
	if err := s.repo.CreatePage(ctx, page); err != nil {
		return nil, err
	}
	return &dto.FAQPageSummaryResponse{Key: page.Key, Name: page.Name, Path: page.Path, Description: page.Description}, nil
}

func (s *FAQService) UpdatePage(ctx context.Context, key string, req dto.UpdateFAQPageRequest) error {
	name, path, description, err := cleanPageFields(req.Name, req.Path, req.Description)
	if err != nil {
		return err
	}
	page, err := s.repo.FindPage(ctx, key)
	if err != nil {
		return err
	}
	if page == nil {
		return appErrors.ErrFAQPageNotFound
	}
	return s.repo.UpdatePage(ctx, key, name, path, description)
}

func (s *FAQService) DeletePage(ctx context.Context, key string) error {
	page, err := s.repo.FindPage(ctx, key)
	if err != nil {
		return err
	}
	if page == nil {
		return appErrors.ErrFAQPageNotFound
	}
	return s.repo.DeletePage(ctx, key)
}

// categorySlug turns a category title into a URL-safe handle.
func categorySlug(title string) string {
	slug := slugify(title)
	if len(slug) > 60 {
		slug = strings.Trim(slug[:60], "-")
	}
	return slug
}

func cleanCategoryFields(title, icon string) (string, string, error) {
	title, icon = strings.TrimSpace(title), strings.ToLower(strings.TrimSpace(icon))
	if title == "" {
		return "", "", faqInvalid("a category needs a title")
	}
	if len(title) > maxFAQNameLen {
		return "", "", faqInvalid("the category title is too long")
	}
	if !faqIconRe.MatchString(icon) {
		return "", "", faqInvalid("that icon name isn't valid")
	}
	return title, icon, nil
}

func (s *FAQService) CreateCategory(ctx context.Context, pageKey string, req dto.CreateFAQCategoryRequest) (*dto.FAQCategoryResponse, error) {
	title, icon, err := cleanCategoryFields(req.Title, req.Icon)
	if err != nil {
		return nil, err
	}
	page, err := s.repo.FindPage(ctx, pageKey)
	if err != nil {
		return nil, err
	}
	if page == nil {
		return nil, appErrors.ErrFAQPageNotFound
	}

	// The slug is fixed at creation so links to ?category=<slug> keep working
	// when the title is later reworded. Clashes within the page get a number.
	base := categorySlug(title)
	slug := base
	for n := 2; ; n++ {
		taken, err := s.repo.CategorySlugExists(ctx, pageKey, slug)
		if err != nil {
			return nil, err
		}
		if !taken {
			break
		}
		slug = base + "-" + strconv.Itoa(n)
	}

	order, err := s.repo.NextCategoryOrder(ctx, pageKey)
	if err != nil {
		return nil, err
	}
	c := &domain.FAQCategory{PageKey: pageKey, Slug: slug, Title: title, Icon: icon, DisplayOrder: order}
	if err := s.repo.CreateCategory(ctx, c); err != nil {
		return nil, err
	}
	return &dto.FAQCategoryResponse{
		ID: c.ID, Slug: c.Slug, Title: c.Title, Icon: c.Icon, DisplayOrder: c.DisplayOrder, FAQs: []dto.FAQItemResponse{},
	}, nil
}

func (s *FAQService) UpdateCategory(ctx context.Context, id string, req dto.UpdateFAQCategoryRequest) error {
	if err := checkUUID(id); err != nil {
		return err
	}
	title, icon, err := cleanCategoryFields(req.Title, req.Icon)
	if err != nil {
		return err
	}
	c, err := s.repo.FindCategory(ctx, id)
	if err != nil {
		return err
	}
	if c == nil {
		return appErrors.ErrFAQCategoryNotFound
	}
	return s.repo.UpdateCategory(ctx, id, title, icon)
}

func (s *FAQService) DeleteCategory(ctx context.Context, id string) error {
	if err := checkUUID(id); err != nil {
		return err
	}
	c, err := s.repo.FindCategory(ctx, id)
	if err != nil {
		return err
	}
	if c == nil {
		return appErrors.ErrFAQCategoryNotFound
	}
	return s.repo.DeleteCategory(ctx, id)
}

func checkUUID(id string) error {
	if _, err := uuid.Parse(id); err != nil {
		return faqInvalid("that id isn't valid")
	}
	return nil
}

// cleanItemFields validates a question and sanitizes its answer. The answer is
// editor HTML (or legacy plain text); it is rendered on the public site, so it
// is cleaned here on write like every other rich-text field.
func cleanItemFields(question, answer string) (string, string, error) {
	question = strings.TrimSpace(question)
	if question == "" {
		return "", "", faqInvalid("a FAQ needs a question")
	}
	if len([]rune(question)) > maxFAQQuestionLen {
		return "", "", faqInvalid("the question is too long")
	}
	answer = richtext.SanitizeBasic(strings.TrimSpace(answer))
	if richtext.PlainText(answer) == "" {
		return "", "", faqInvalid("a FAQ needs an answer")
	}
	return question, answer, nil
}

// checkItemCategory makes sure a question is only filed under a category of its own page.
func (s *FAQService) checkItemCategory(ctx context.Context, pageKey string, categoryID *string) error {
	if categoryID == nil {
		return nil
	}
	if err := checkUUID(*categoryID); err != nil {
		return err
	}
	c, err := s.repo.FindCategory(ctx, *categoryID)
	if err != nil {
		return err
	}
	if c == nil || c.PageKey != pageKey {
		return appErrors.ErrFAQCategoryNotFound
	}
	return nil
}

func (s *FAQService) CreateItem(ctx context.Context, pageKey string, req dto.CreateFAQItemRequest) (*dto.FAQItemResponse, error) {
	question, answer, err := cleanItemFields(req.Question, req.Answer)
	if err != nil {
		return nil, err
	}
	page, err := s.repo.FindPage(ctx, pageKey)
	if err != nil {
		return nil, err
	}
	if page == nil {
		return nil, appErrors.ErrFAQPageNotFound
	}
	if err := s.checkItemCategory(ctx, pageKey, req.CategoryID); err != nil {
		return nil, err
	}
	order, err := s.repo.NextItemOrder(ctx, pageKey, req.CategoryID)
	if err != nil {
		return nil, err
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	item := &domain.FAQItem{
		PageKey: pageKey, CategoryID: req.CategoryID, Question: question, Answer: answer,
		DisplayOrder: order, IsActive: isActive,
	}
	if err := s.repo.CreateItem(ctx, item); err != nil {
		return nil, err
	}
	resp := faqItemToResponse(item)
	return &resp, nil
}

func (s *FAQService) UpdateItem(ctx context.Context, id string, req dto.UpdateFAQItemRequest) error {
	if err := checkUUID(id); err != nil {
		return err
	}
	question, answer, err := cleanItemFields(req.Question, req.Answer)
	if err != nil {
		return err
	}
	item, err := s.repo.FindItem(ctx, id)
	if err != nil {
		return err
	}
	if item == nil {
		return appErrors.ErrFAQItemNotFound
	}
	if err := s.checkItemCategory(ctx, item.PageKey, req.CategoryID); err != nil {
		return err
	}

	// Moving to another category puts the question last there, rather than
	// leaving it with an order number that means something else in its new list.
	if !sameCategory(item.CategoryID, req.CategoryID) {
		order, err := s.repo.NextItemOrder(ctx, item.PageKey, req.CategoryID)
		if err != nil {
			return err
		}
		item.DisplayOrder = order
	}
	item.CategoryID = req.CategoryID
	item.Question = question
	item.Answer = answer
	item.IsActive = req.IsActive != nil && *req.IsActive
	return s.repo.UpdateItem(ctx, item)
}

func sameCategory(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func (s *FAQService) DeleteItem(ctx context.Context, id string) error {
	if err := checkUUID(id); err != nil {
		return err
	}
	item, err := s.repo.FindItem(ctx, id)
	if err != nil {
		return err
	}
	if item == nil {
		return appErrors.ErrFAQItemNotFound
	}
	return s.repo.DeleteItem(ctx, id)
}

func (s *FAQService) Reorder(ctx context.Context, req dto.ReorderFAQRequest) error {
	if len(req.IDs) == 0 || len(req.IDs) > maxFAQReorderIDs {
		return faqInvalid("nothing to reorder")
	}
	seen := make(map[string]struct{}, len(req.IDs))
	for _, id := range req.IDs {
		if err := checkUUID(id); err != nil {
			return err
		}
		if _, dup := seen[id]; dup {
			return faqInvalid("the same id appears twice")
		}
		seen[id] = struct{}{}
	}

	switch req.Kind {
	case "category":
		return s.repo.ReorderCategories(ctx, req.IDs)
	case "item":
		return s.repo.ReorderItems(ctx, req.IDs)
	default:
		return faqInvalid(`kind must be "category" or "item"`)
	}
}
