package services

import (
	"context"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"sync"
	"time"
)

type IAnalyticsService interface {
	GetAdminDashboardMetrics(ctx context.Context) (*dto.AdminAnalyticsResponse, error)
	GetRepeatCustomerReport(ctx context.Context, eventDayID string) (*dto.RepeatCustomerReport, error)
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

	wg.Add(5)

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

	return &resp, nil
}

// GetRepeatCustomerReport is the weekly look at who came back: every match day
// that sold tickets with its share of returning buyers, and the returning buyers
// for one of them. With no match day given it picks the next one with sales, or
// the latest past one when none are left.
func (s *AnalyticsService) GetRepeatCustomerReport(ctx context.Context, eventDayID string) (*dto.RepeatCustomerReport, error) {
	days, err := s.analyticsRepo.RepeatCustomerDays(ctx)
	if err != nil {
		return nil, err
	}

	report := &dto.RepeatCustomerReport{
		Days:      make([]dto.RepeatCustomerDay, 0, len(days)),
		Customers: []dto.RepeatCustomer{},
	}
	for _, d := range days {
		report.Days = append(report.Days, dto.RepeatCustomerDay{
			EventDayID: d.EventDayID,
			Title:      d.Title,
			Date:       d.Date,
			Buyers:     d.Buyers,
			Returning:  d.Returning,
		})
	}

	if eventDayID == "" {
		eventDayID = defaultReportDay(days, todayLagos(time.Now()).Format("2006-01-02"))
	}
	report.EventDayID = eventDayID
	if eventDayID == "" {
		return report, nil
	}

	customers, err := s.analyticsRepo.RepeatCustomers(ctx, eventDayID)
	if err != nil {
		return nil, err
	}
	for _, c := range customers {
		report.Customers = append(report.Customers, dto.RepeatCustomer{
			Name:           c.Name,
			Email:          c.Email,
			Phone:          c.Phone,
			Tickets:        c.Tickets,
			Spent:          c.Spent,
			PriorPurchases: c.PriorPurchases,
			FirstBoughtAt:  c.FirstBoughtAt.UTC().Format(time.RFC3339),
		})
	}
	return report, nil
}

// defaultReportDay picks the match day to open the report on. Days come newest
// first, so the next upcoming one is the last day that is not before today.
func defaultReportDay(days []ports.RepeatCustomerDay, today string) string {
	upcoming := ""
	for _, d := range days {
		if d.Date >= today {
			upcoming = d.EventDayID
		}
	}
	if upcoming != "" {
		return upcoming
	}
	if len(days) > 0 {
		return days[0].EventDayID
	}
	return ""
}
