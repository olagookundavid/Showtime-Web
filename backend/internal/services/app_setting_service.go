package services

import (
	"context"
	"fmt"
	"regexp"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

const (
	// SettingKeyAppFont is the site-wide font every client reads on boot.
	SettingKeyAppFont = "app_font_id"
	// DefaultAppFontID must stay in step with the default entry in the
	// frontend font catalogue (frontend/src/contexts/FontContext.tsx).
	DefaultAppFontID = "georgia"
)

// Font ids are catalogue lookup keys, never CSS. Constraining them to a slug
// keeps junk out of the table without duplicating the font list back here — an
// id the frontend doesn't recognise simply falls back to the default there.
var fontIDPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

type IAppSettingService interface {
	GetSettings(ctx context.Context) (*dto.AppSettingsResponse, error)
	UpdateAppFont(ctx context.Context, fontID string) (*dto.AppSettingsResponse, error)
}

type AppSettingService struct {
	repo ports.IAppSettingRepository
}

func NewAppSettingService(repo ports.IAppSettingRepository) IAppSettingService {
	return &AppSettingService{repo: repo}
}

func (s *AppSettingService) GetSettings(ctx context.Context) (*dto.AppSettingsResponse, error) {
	fontID, err := s.repo.Get(ctx, SettingKeyAppFont)
	if err != nil {
		return nil, err
	}
	if fontID == "" {
		fontID = DefaultAppFontID
	}
	return &dto.AppSettingsResponse{AppFontID: fontID}, nil
}

func (s *AppSettingService) UpdateAppFont(ctx context.Context, fontID string) (*dto.AppSettingsResponse, error) {
	if len(fontID) > 40 || !fontIDPattern.MatchString(fontID) {
		return nil, fmt.Errorf("invalid font id")
	}

	if err := s.repo.Set(ctx, SettingKeyAppFont, fontID); err != nil {
		return nil, err
	}
	return &dto.AppSettingsResponse{AppFontID: fontID}, nil
}
