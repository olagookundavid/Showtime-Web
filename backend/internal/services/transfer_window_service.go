package services

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type ITransferWindowService interface {
	CreateWindow(ctx context.Context, req dto.TransferWindowRequest) (*dto.TransferWindowResponse, error)
	GetActiveWindow(ctx context.Context) (*dto.TransferWindowResponse, error)
	GetAllWindows(ctx context.Context) ([]dto.TransferWindowResponse, error)
	UpdateWindow(ctx context.Context, id string, req dto.TransferWindowRequest) (*dto.TransferWindowResponse, error)
	DeleteWindow(ctx context.Context, id string) error
	IsWindowOpen(ctx context.Context) (bool, error)
}

type TransferWindowService struct {
	repo ports.ITransferWindowRepository
}

func NewTransferWindowService(repo ports.ITransferWindowRepository) ITransferWindowService {
	return &TransferWindowService{repo: repo}
}

func (s *TransferWindowService) CreateWindow(ctx context.Context, req dto.TransferWindowRequest) (*dto.TransferWindowResponse, error) {
	opensAt, err := time.Parse(time.RFC3339, req.OpensAt)
	if err != nil {
		return nil, fmt.Errorf("invalid opens_at date format: %w", err)
	}

	closesAt, err := time.Parse(time.RFC3339, req.ClosesAt)
	if err != nil {
		return nil, fmt.Errorf("invalid closes_at date format: %w", err)
	}

	if closesAt.Before(opensAt) || closesAt.Equal(opensAt) {
		return nil, fmt.Errorf("closes_at must be after opens_at")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	w := &domain.TransferWindow{
		Name:     req.Name,
		OpensAt:  opensAt,
		ClosesAt: closesAt,
		IsActive: isActive,
	}

	if err := s.repo.CreateWindow(ctx, w); err != nil {
		return nil, err
	}

	res := s.mapToResponse(w)
	return &res, nil
}

func (s *TransferWindowService) GetActiveWindow(ctx context.Context) (*dto.TransferWindowResponse, error) {
	w, err := s.repo.GetActiveWindow(ctx)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, nil
	}
	res := s.mapToResponse(w)
	return &res, nil
}

func (s *TransferWindowService) IsWindowOpen(ctx context.Context) (bool, error) {
	return s.repo.IsWindowOpen(ctx)
}

func (s *TransferWindowService) GetAllWindows(ctx context.Context) ([]dto.TransferWindowResponse, error) {
	windows, err := s.repo.GetAllWindows(ctx)
	if err != nil {
		return nil, err
	}

	res := make([]dto.TransferWindowResponse, 0, len(windows))
	for _, w := range windows {
		res = append(res, s.mapToResponse(&w))
	}
	return res, nil
}

func (s *TransferWindowService) UpdateWindow(ctx context.Context, id string, req dto.TransferWindowRequest) (*dto.TransferWindowResponse, error) {
	w, err := s.repo.GetWindowByID(ctx, id)
	if err != nil || w == nil {
		return nil, fmt.Errorf("transfer window not found")
	}

	if req.Name != "" {
		w.Name = req.Name
	}

	if req.OpensAt != "" {
		opensAt, err := time.Parse(time.RFC3339, req.OpensAt)
		if err != nil {
			return nil, fmt.Errorf("invalid opens_at format: %w", err)
		}
		w.OpensAt = opensAt
	}

	if req.ClosesAt != "" {
		closesAt, err := time.Parse(time.RFC3339, req.ClosesAt)
		if err != nil {
			return nil, fmt.Errorf("invalid closes_at format: %w", err)
		}
		w.ClosesAt = closesAt
	}

	if w.ClosesAt.Before(w.OpensAt) || w.ClosesAt.Equal(w.OpensAt) {
		return nil, fmt.Errorf("closes_at must be after opens_at")
	}

	if req.IsActive != nil {
		w.IsActive = *req.IsActive
	}

	if err := s.repo.UpdateWindow(ctx, w); err != nil {
		return nil, err
	}

	res := s.mapToResponse(w)
	return &res, nil
}

func (s *TransferWindowService) DeleteWindow(ctx context.Context, id string) error {
	return s.repo.DeleteWindow(ctx, id)
}

func (s *TransferWindowService) mapToResponse(w *domain.TransferWindow) dto.TransferWindowResponse {
	now := time.Now()
	isOpen := w.IsActive && now.After(w.OpensAt) && now.Before(w.ClosesAt)

	return dto.TransferWindowResponse{
		ID:        w.ID,
		Name:      w.Name,
		OpensAt:   w.OpensAt.Format("2006-01-02T15:04:05Z07:00"),
		ClosesAt:  w.ClosesAt.Format("2006-01-02T15:04:05Z07:00"),
		IsActive:  w.IsActive,
		IsOpen:    isOpen,
		CreatedAt: w.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: w.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
