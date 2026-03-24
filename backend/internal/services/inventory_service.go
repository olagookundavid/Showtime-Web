package services

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"time"

	"github.com/google/uuid"
)

type IInventoryService interface {
	CreateProduct(ctx context.Context, req dto.CreateProductRequest) (*dto.ProductResponse, error)
	UpdateProduct(ctx context.Context, id string, req dto.UpdateProductRequest) (*dto.ProductResponse, error)
	DeleteProduct(ctx context.Context, id string) error
	GetProduct(ctx context.Context, id string) (*dto.ProductResponse, error)
	ListProducts(ctx context.Context, page, limit int, search string, activeOnly bool) ([]dto.ProductResponse, int, error)
	GetLowStockAlerts(ctx context.Context) ([]dto.ProductResponse, error)
	LogSale(ctx context.Context, sellerID string, req dto.LogSaleRequest) (*dto.SaleResponse, error)
	ListSales(ctx context.Context, filters dto.SaleFilters) ([]dto.SaleResponse, int, error)
	GetSalesReport(ctx context.Context, period, fromDateStr, toDateStr string) (*dto.SalesReportResponse, error)

	ListPaymentMethods(ctx context.Context, activeOnly bool) ([]dto.PaymentMethodResponse, error)
	CreatePaymentMethod(ctx context.Context, req dto.CreatePaymentMethodRequest) (*dto.PaymentMethodResponse, error)
	TogglePaymentMethod(ctx context.Context, id string, isActive bool) error
}

type InventoryService struct {
	repo ports.IInventoryRepository
}

func NewInventoryService(repo ports.IInventoryRepository) IInventoryService {
	return &InventoryService{repo: repo}
}

func mapProductToResponse(p *domain.Product) *dto.ProductResponse {
	return &dto.ProductResponse{
		ID:          p.ID,
		Name:        p.Name,
		SKU:         p.SKU,
		Description: p.Description,
		Price:       p.Price,
		Quantity:    p.Quantity,
		Threshold:   p.Threshold,
		IsActive:    p.IsActive,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}

func (s *InventoryService) CreateProduct(ctx context.Context, req dto.CreateProductRequest) (*dto.ProductResponse, error) {
	p := domain.Product{
		Name:        req.Name,
		SKU:         fmt.Sprintf("sffl-%s", uuid.New().String()[:8]),
		Description: req.Description,
		Price:       req.Price,
		Quantity:    req.Quantity,
		Threshold:   req.Threshold,
		IsActive:    true,
	}

	created, err := s.repo.CreateProduct(ctx, p)
	if err != nil {
		return nil, err
	}
	return mapProductToResponse(created), nil
}

func (s *InventoryService) UpdateProduct(ctx context.Context, id string, req dto.UpdateProductRequest) (*dto.ProductResponse, error) {
	existing, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Price != nil {
		existing.Price = *req.Price
	}
	if req.Quantity != nil {
		existing.Quantity = *req.Quantity
	}
	if req.Threshold != nil {
		existing.Threshold = *req.Threshold
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	updated, err := s.repo.UpdateProduct(ctx, id, *existing)
	if err != nil {
		return nil, err
	}
	return mapProductToResponse(updated), nil
}

func (s *InventoryService) DeleteProduct(ctx context.Context, id string) error {
	// First check if it has sales
	sales, _, err := s.repo.ListSales(ctx, 1, 1, &id, nil, nil, nil)
	if err != nil {
		return err
	}
	if len(sales) > 0 {
		return errors.New("cannot delete product with sales history; consider deactivating it instead")
	}

	return s.repo.DeleteProduct(ctx, id)
}

func (s *InventoryService) GetProduct(ctx context.Context, id string) (*dto.ProductResponse, error) {
	p, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	return mapProductToResponse(p), nil
}

func (s *InventoryService) ListProducts(ctx context.Context, page, limit int, search string, activeOnly bool) ([]dto.ProductResponse, int, error) {
	products, total, err := s.repo.ListProducts(ctx, page, limit, search, activeOnly)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.ProductResponse, 0, len(products))
	for _, p := range products {
		responses = append(responses, *mapProductToResponse(&p))
	}
	return responses, total, nil
}

func (s *InventoryService) GetLowStockAlerts(ctx context.Context) ([]dto.ProductResponse, error) {
	products, err := s.repo.GetLowStockProducts(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.ProductResponse, 0, len(products))
	for _, p := range products {
		responses = append(responses, *mapProductToResponse(&p))
	}
	return responses, nil
}

func (s *InventoryService) LogSale(ctx context.Context, sellerID string, req dto.LogSaleRequest) (*dto.SaleResponse, error) {
	sale := domain.Sale{
		ProductID:     req.ProductID,
		SellerID:      sellerID,
		QuantitySold:  req.QuantitySold,
		PaymentMethod: req.PaymentMethod,
		Notes:         req.Notes,
	}

	created, err := s.repo.LogSale(ctx, sale)
	if err != nil {
		if err.Error() == "insufficient stock" {
			return nil, errors.New("insufficient stock available")
		}
		return nil, err
	}

	return &dto.SaleResponse{
		ID:            created.ID,
		ProductID:     created.ProductID,
		SellerID:      created.SellerID,
		SellerName:    created.SellerName,
		QuantitySold:  created.QuantitySold,
		UnitPrice:     created.UnitPrice,
		TotalAmount:   created.TotalAmount,
		PaymentMethod: created.PaymentMethod,
		Notes:         created.Notes,
		SoldAt:        created.SoldAt,
	}, nil
}

func parseOptionalDate(dateStr *string, isEndOfDay bool) *time.Time {
	if dateStr == nil || *dateStr == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *dateStr)
	if err != nil {
		t, err = time.Parse("2006-01-02", *dateStr)
		if err == nil && isEndOfDay {
			t = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, t.Location())
		}
	}
	if err == nil {
		return &t
	}
	return nil
}

func (s *InventoryService) ListSales(ctx context.Context, filters dto.SaleFilters) ([]dto.SaleResponse, int, error) {
	page := filters.Page
	if page < 1 {
		page = 1
	}
	limit := filters.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}

	fromDate := parseOptionalDate(filters.FromDate, false)
	toDate := parseOptionalDate(filters.ToDate, true)

	sales, total, err := s.repo.ListSales(ctx, page, limit, filters.ProductID, filters.SellerID, fromDate, toDate)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.SaleResponse, 0, len(sales))
	for _, sale := range sales {
		responses = append(responses, dto.SaleResponse{
			ID:            sale.ID,
			ProductID:     sale.ProductID,
			ProductName:   sale.ProductName,
			SellerID:      sale.SellerID,
			SellerName:    sale.SellerName,
			QuantitySold:  sale.QuantitySold,
			UnitPrice:     sale.UnitPrice,
			TotalAmount:   sale.TotalAmount,
			PaymentMethod: sale.PaymentMethod,
			Notes:         sale.Notes,
			SoldAt:        sale.SoldAt,
		})
	}
	return responses, total, nil
}

func (s *InventoryService) GetSalesReport(ctx context.Context, period, fromDateStr, toDateStr string) (*dto.SalesReportResponse, error) {
	now := time.Now()
	var fromDate time.Time
	var toDate time.Time = now

	if fromDateStr != "" && toDateStr != "" {
		parsedFrom, err1 := time.Parse("2006-01-02", fromDateStr)
		parsedTo, err2 := time.Parse("2006-01-02", toDateStr)
		if err1 == nil && err2 == nil {
			fromDate = parsedFrom
			// Set to end of the day for toDate to include all sales on that day
			toDate = time.Date(parsedTo.Year(), parsedTo.Month(), parsedTo.Day(), 23, 59, 59, 999999999, parsedTo.Location())
			period = "custom"
		}
	} else {
		switch period {
		case "daily":
			fromDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		case "weekly":
			fromDate = now.AddDate(0, 0, -7)
		case "monthly":
			fromDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		default:
			period = "daily"
			fromDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		}
	}

	raw, err := s.repo.GetRawSalesReport(ctx, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	res := &dto.SalesReportResponse{
		Period:       period,
		FromDate:     fromDate,
		ToDate:       toDate,
		TotalRevenue: raw.TotalRevenue,
		TotalUnits:   raw.TotalUnits,
		ByProduct:    make([]dto.SalesReportItem, 0, len(raw.ByProduct)),
		BySeller:     make([]dto.SalesReportSeller, 0, len(raw.BySeller)),
	}

	for _, p := range raw.ByProduct {
		res.ByProduct = append(res.ByProduct, dto.SalesReportItem{
			ProductID:   p.ProductID,
			ProductName: p.Name,
			UnitsSold:   p.Units,
			Revenue:     p.Revenue,
		})
	}

	for _, s := range raw.BySeller {
		res.BySeller = append(res.BySeller, dto.SalesReportSeller{
			SellerID:   s.SellerID,
			SellerName: s.Name,
			UnitsSold:  s.Units,
			Revenue:    s.Revenue,
		})
	}

	res.ByPaymentMethod = make([]dto.SalesReportPaymentMethod, 0, len(raw.ByPaymentMethod))
	for _, p := range raw.ByPaymentMethod {
		res.ByPaymentMethod = append(res.ByPaymentMethod, dto.SalesReportPaymentMethod{
			PaymentMethod: p.PaymentMethod,
			Revenue:       p.Revenue,
		})
	}

	return res, nil
}

func (s *InventoryService) ListPaymentMethods(ctx context.Context, activeOnly bool) ([]dto.PaymentMethodResponse, error) {
	methods, err := s.repo.ListPaymentMethods(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	res := []dto.PaymentMethodResponse{}
	for _, m := range methods {
		res = append(res, dto.PaymentMethodResponse{
			ID:       m.ID,
			Name:     m.Name,
			IsActive: m.IsActive,
		})
	}
	return res, nil
}

func (s *InventoryService) CreatePaymentMethod(ctx context.Context, req dto.CreatePaymentMethodRequest) (*dto.PaymentMethodResponse, error) {
	m, err := s.repo.CreatePaymentMethod(ctx, req.Name)
	if err != nil {
		return nil, err
	}
	return &dto.PaymentMethodResponse{
		ID:       m.ID,
		Name:     m.Name,
		IsActive: m.IsActive,
	}, nil
}

func (s *InventoryService) TogglePaymentMethod(ctx context.Context, id string, isActive bool) error {
	return s.repo.TogglePaymentMethod(ctx, id, isActive)
}
