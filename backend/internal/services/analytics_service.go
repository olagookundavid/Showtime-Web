package services

import (
	"context"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"sync"
)

type IAnalyticsService interface {
	GetAdminDashboardMetrics(ctx context.Context) (*dto.AdminAnalyticsResponse, error)
}

type AnalyticsService struct {
	authRepo      ports.IAuthRepository
	ticketRepo    ports.TicketRepository
	analyticsRepo ports.IAnalyticsRepository
}

func NewAnalyticsService(authRepo ports.IAuthRepository, ticketRepo ports.TicketRepository, analyticsRepo ports.IAnalyticsRepository) *AnalyticsService {
	return &AnalyticsService{
		authRepo:      authRepo,
		ticketRepo:    ticketRepo,
		analyticsRepo: analyticsRepo,
	}
}

func (s *AnalyticsService) GetAdminDashboardMetrics(ctx context.Context) (*dto.AdminAnalyticsResponse, error) {
	var resp dto.AdminAnalyticsResponse
	var errs []error
	var wg sync.WaitGroup
	var mu sync.Mutex

	wg.Add(6)

	_ = SubmitJob(func() {
		defer wg.Done()
		total, err := s.ticketRepo.GetTotalRevenue(ctx)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		resp.TotalRevenue = total
	})

	_ = SubmitJob(func() {
		defer wg.Done()
		total, err := s.ticketRepo.GetTotalTicketsSold(ctx)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		resp.TotalTicketsSold = total
	})

	_ = SubmitJob(func() {
		defer wg.Done()
		total, err := s.authRepo.CountTotalUsers(ctx)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		resp.TotalUsers = total
	})

	_ = SubmitJob(func() {
		defer wg.Done()
		tickets, err := s.ticketRepo.GetRecentSales(ctx, 10)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		var recent []dto.TicketResponse
		for _, t := range tickets {
			recent = append(recent, *ticketToResponse(&t))
		}
		resp.RecentSales = recent
	})

	_ = SubmitJob(func() {
		defer wg.Done()
		roles, err := s.analyticsRepo.GetUsersByRole(ctx)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		resp.UsersByRole = roles
	})

	_ = SubmitJob(func() {
		defer wg.Done()
		sales, err := s.analyticsRepo.GetSalesByTier(ctx)
		if err != nil {
			mu.Lock()
			errs = append(errs, err)
			mu.Unlock()
			return
		}
		var salesDto []dto.SalesByTier
		for _, s := range sales {
			salesDto = append(salesDto, dto.SalesByTier{
				TierName:    s.TierName,
				TotalAmount: s.TotalAmount,
				Quantity:    s.Quantity,
			})
		}
		resp.SalesByTier = salesDto
	})

	wg.Wait()

	if len(errs) > 0 {
		return nil, errs[0] // Return the first error encountered
	}

	// Ensure RecentSales is initialized to an empty slice instead of nil
	if resp.RecentSales == nil {
		resp.RecentSales = []dto.TicketResponse{}
	}

	return &resp, nil
}
