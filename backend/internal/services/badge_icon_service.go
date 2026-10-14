package services

import (
	"context"
	"errors"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"strings"
)

// ErrBadgeIconInvalid is returned for a library entry with no name or image.
var ErrBadgeIconInvalid = errors.New("give the artwork a name and an image")

func badgeIconResponse(ic domain.BadgeIcon) dto.BadgeIconResponse {
	usedBy := ic.UsedBy
	if usedBy == nil {
		usedBy = []string{}
	}
	return dto.BadgeIconResponse{
		ID:        ic.ID,
		Name:      ic.Name,
		ImageURL:  ic.ImageURL,
		UsedBy:    usedBy,
		CreatedAt: ic.CreatedAt,
		UpdatedAt: ic.UpdatedAt,
	}
}

func cleanBadgeIcon(req dto.SaveBadgeIconRequest) (string, string, error) {
	name, url := strings.TrimSpace(req.Name), strings.TrimSpace(req.ImageURL)
	if name == "" || url == "" {
		return "", "", ErrBadgeIconInvalid
	}
	return name, url, nil
}

// ListBadgeIcons returns the badge artwork library.
func (s *BadgeService) ListBadgeIcons(ctx context.Context) ([]dto.BadgeIconResponse, error) {
	icons, err := s.badgeRepo.ListBadgeIcons(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.BadgeIconResponse, len(icons))
	for i, ic := range icons {
		out[i] = badgeIconResponse(ic)
	}
	return out, nil
}

// CreateBadgeIcon adds artwork to the library.
func (s *BadgeService) CreateBadgeIcon(ctx context.Context, req dto.SaveBadgeIconRequest) (*dto.BadgeIconResponse, error) {
	name, url, err := cleanBadgeIcon(req)
	if err != nil {
		return nil, err
	}
	ic, err := s.badgeRepo.CreateBadgeIcon(ctx, name, url)
	if err != nil {
		return nil, err
	}
	res := badgeIconResponse(*ic)
	return &res, nil
}

// UpdateBadgeIcon renames artwork or replaces its image; badges showing the old
// image switch to the new one.
func (s *BadgeService) UpdateBadgeIcon(ctx context.Context, id string, req dto.SaveBadgeIconRequest) (*dto.UpdateBadgeIconResponse, error) {
	name, url, err := cleanBadgeIcon(req)
	if err != nil {
		return nil, err
	}
	ic, moved, err := s.badgeRepo.UpdateBadgeIcon(ctx, id, name, url)
	if err != nil {
		return nil, err
	}
	return &dto.UpdateBadgeIconResponse{Icon: badgeIconResponse(*ic), BadgesUpdated: moved}, nil
}

// DeleteBadgeIcon removes artwork no badge is using.
func (s *BadgeService) DeleteBadgeIcon(ctx context.Context, id string) error {
	return s.badgeRepo.DeleteBadgeIcon(ctx, id)
}
