package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
	"strings"

	"github.com/google/uuid"
)

type IStoreService interface {
	ListStoreProducts(ctx context.Context) ([]dto.StoreProductResponse, error)
	GetStoreProduct(ctx context.Context, id string) (*dto.StoreProductResponse, error)
	CreateOrder(ctx context.Context, userID *string, req dto.CheckoutRequest) (*dto.CheckoutResponse, error)
	VerifyPayment(ctx context.Context, paystackRef string) (*dto.OrderResponse, error)
	VerifyOrder(ctx context.Context, id string) (*dto.OrderResponse, error)
	GetOrder(ctx context.Context, id string) (*dto.OrderResponse, error)
	GetOrderByReference(ctx context.Context, reference string) (*dto.OrderResponse, error)
	ListOrders(ctx context.Context, page, limit int, userID *string, paymentStatus *string, fulfillmentStatus *string) ([]dto.OrderResponse, int, error)
	UpdateFulfillmentStatus(ctx context.Context, id string, status string) (*dto.OrderResponse, error)
	ListSavedAddresses(ctx context.Context, userID string) ([]dto.SavedAddressResponse, error)
	SaveAddress(ctx context.Context, userID string, req dto.SaveAddressRequest) (*dto.SavedAddressResponse, error)
	SaveProductVariants(ctx context.Context, productID string, req []dto.ProductVariantResponse) error
	SaveProductImages(ctx context.Context, productID string, req []dto.ProductImageResponse) error

	// Admin online e-commerce catalog CRUD actions
	CreateStoreProduct(ctx context.Context, req dto.CreateStoreProductRequest) (*dto.StoreProductResponse, error)
	UpdateStoreProduct(ctx context.Context, id string, req dto.UpdateStoreProductRequest) error
	DeleteStoreProduct(ctx context.Context, id string) error
	ListAllStoreProducts(ctx context.Context) ([]dto.StoreProductResponse, error)
}

type StoreService struct {
	repo           ports.IStoreRepository
	paystackClient *PaystackClient
	emailService   *email.ResendService
}

func NewStoreService(repo ports.IStoreRepository, paystackClient *PaystackClient, emailService *email.ResendService) IStoreService {
	return &StoreService{
		repo:           repo,
		paystackClient: paystackClient,
		emailService:   emailService,
	}
}

func mapProductToStoreResponse(p *domain.Product) dto.StoreProductResponse {
	res := dto.StoreProductResponse{
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
		Images:      make([]dto.ProductImageResponse, 0, len(p.Images)),
		Variants:    make([]dto.ProductVariantResponse, 0, len(p.Variants)),
	}

	for _, img := range p.Images {
		res.Images = append(res.Images, dto.ProductImageResponse{
			ID:           img.ID,
			ImageURL:     img.ImageURL,
			IsPrimary:    img.IsPrimary,
			DisplayOrder: img.DisplayOrder,
		})
	}

	for _, v := range p.Variants {
		price := p.Price
		if v.Price != nil {
			price = *v.Price
		}
		res.Variants = append(res.Variants, dto.ProductVariantResponse{
			ID:           v.ID,
			VariantName:  v.VariantName,
			VariantValue: v.VariantValue,
			SKU:          v.SKU,
			Price:        price,
			Quantity:     v.Quantity,
		})
	}

	return res
}

func (s *StoreService) ListStoreProducts(ctx context.Context) ([]dto.StoreProductResponse, error) {
	products, err := s.repo.ListStoreProducts(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.StoreProductResponse, 0, len(products))
	for _, p := range products {
		responses = append(responses, mapProductToStoreResponse(&p))
	}
	return responses, nil
}

func (s *StoreService) GetStoreProduct(ctx context.Context, id string) (*dto.StoreProductResponse, error) {
	p, err := s.repo.GetStoreProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	res := mapProductToStoreResponse(p)
	return &res, nil
}

func generateOrderReference() string {
	// UUID-derived suffix to avoid collisions on the UNIQUE order_reference column.
	id := strings.ReplaceAll(uuid.New().String(), "-", "")
	return fmt.Sprintf("SFFL-ORD-%s", strings.ToUpper(id[:10]))
}

func mapOrderToResponse(o *domain.Order) dto.OrderResponse {
	res := dto.OrderResponse{
		ID:                 o.ID,
		OrderReference:     o.OrderReference,
		UserID:             o.UserID,
		CustomerName:       o.CustomerName,
		CustomerEmail:      o.CustomerEmail,
		CustomerPhone:      o.CustomerPhone,
		ShippingCountry:    o.ShippingCountry,
		ShippingState:      o.ShippingState,
		ShippingCity:       o.ShippingCity,
		ShippingAddress:    o.ShippingAddress,
		ShippingPostalCode: o.ShippingPostalCode,
		TotalAmount:        o.TotalAmount,
		PaymentStatus:      o.PaymentStatus,
		FulfillmentStatus:  o.FulfillmentStatus,
		PaystackReference:  o.PaystackReference,
		CreatedAt:          o.CreatedAt,
		UpdatedAt:          o.UpdatedAt,
		Items:              make([]dto.OrderItemResponse, 0, len(o.Items)),
	}

	for _, item := range o.Items {
		res.Items = append(res.Items, dto.OrderItemResponse{
			ID:           item.ID,
			ProductID:    item.ProductID,
			ProductName:   item.ProductName,
			VariantID:    item.VariantID,
			VariantName:  item.VariantName,
			VariantValue: item.VariantValue,
			Quantity:     item.Quantity,
			UnitPrice:    item.UnitPrice,
			TotalPrice:   float64(item.Quantity) * item.UnitPrice,
		})
	}

	return res
}

func (s *StoreService) CreateOrder(ctx context.Context, userID *string, req dto.CheckoutRequest) (*dto.CheckoutResponse, error) {
	if len(req.Items) == 0 {
		return nil, errors.New("cannot create order with no items")
	}

	var totalAmount float64
	orderItems := make([]domain.OrderItem, 0, len(req.Items))

	// Validate items, quantities and price options
	for _, reqItem := range req.Items {
		p, err := s.repo.GetStoreProduct(ctx, reqItem.ProductID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch product %s: %w", reqItem.ProductID, err)
		}

		unitPrice := p.Price
		var variantName, variantValue string

		// If variant was chosen, check variant stock & override price
		if reqItem.VariantID != nil && *reqItem.VariantID != "" {
			var selectedVariant *domain.ProductVariant
			for _, v := range p.Variants {
				if v.ID == *reqItem.VariantID {
					selectedVariant = &v
					break
				}
			}

			if selectedVariant == nil {
				return nil, fmt.Errorf("variant %s not found on product", *reqItem.VariantID)
			}

			if selectedVariant.Quantity < reqItem.Quantity {
				return nil, fmt.Errorf("insufficient stock for variant: %s (%s)", selectedVariant.VariantName, selectedVariant.VariantValue)
			}

			if selectedVariant.Price != nil {
				unitPrice = *selectedVariant.Price
			}
			variantName = selectedVariant.VariantName
			variantValue = selectedVariant.VariantValue
		} else {
			// Fallback to base product global quantity checks
			if p.Quantity < reqItem.Quantity {
				return nil, fmt.Errorf("insufficient global stock for product: %s", p.Name)
			}
		}

		totalAmount += float64(reqItem.Quantity) * unitPrice

		orderItems = append(orderItems, domain.OrderItem{
			ProductID:    reqItem.ProductID,
			ProductName:   p.Name,
			VariantID:    reqItem.VariantID,
			VariantName:  variantName,
			VariantValue: variantValue,
			Quantity:     reqItem.Quantity,
			UnitPrice:    unitPrice,
		})
	}

	paystackRef := fmt.Sprintf("sffl-pay-%s", uuid.New().String()[:8])
	orderRef := generateOrderReference()

	// Convert Naira float64 to Paystack Kobo int
	paystackAmountKobo := int(totalAmount * 100)

	// Fetch callback URL from configs
	callbackURL := os.Getenv("PAYSTACK_STORE_CALLBACK_URL")
	if callbackURL == "" {
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://localhost:5173"
		}
		callbackURL = fmt.Sprintf("%s/store/confirm", frontendURL)
	}

	// Initialize Paystack payment
	paystackReq := PaystackInitRequest{
		Email:       req.CustomerEmail,
		Amount:      paystackAmountKobo,
		Reference:   paystackRef,
		CallbackURL: callbackURL,
	}

	paystackResp, err := s.paystackClient.InitializeTransaction(paystackReq)
	if err != nil {
		return nil, fmt.Errorf("paystack initialization failed: %w", err)
	}

	// Create pending order in database
	order := domain.Order{
		OrderReference:     orderRef,
		UserID:             userID,
		CustomerName:       req.CustomerName,
		CustomerEmail:      req.CustomerEmail,
		CustomerPhone:      req.CustomerPhone,
		ShippingCountry:    req.ShippingCountry,
		ShippingState:      req.ShippingState,
		ShippingCity:       req.ShippingCity,
		ShippingAddress:    req.ShippingAddress,
		ShippingPostalCode: req.ShippingPostalCode,
		TotalAmount:        totalAmount,
		PaymentStatus:      "pending",
		FulfillmentStatus:  "pending",
		PaystackReference:  paystackRef,
		PaystackAccessCode: paystackResp.Data.AccessCode,
		Items:              orderItems,
	}

	created, err := s.repo.CreateOrder(ctx, order)
	if err != nil {
		return nil, fmt.Errorf("failed to save pending order: %w", err)
	}

	return &dto.CheckoutResponse{
		OrderReference:     created.OrderReference,
		PaystackURL:        paystackResp.Data.AuthorizationURL,
		PaystackRef:        paystackRef,
		PaystackAccessCode: paystackResp.Data.AccessCode,
	}, nil
}

func (s *StoreService) VerifyPayment(ctx context.Context, paystackRef string) (*dto.OrderResponse, error) {
	// Fetch order
	order, err := s.repo.GetOrderByPaystackRef(ctx, paystackRef)
	if err != nil {
		return nil, fmt.Errorf("order not found for paystack reference %s: %w", paystackRef, err)
	}

	// If already paid, return immediately to bypass duplicate calls
	if order.PaymentStatus == "paid" {
		res := mapOrderToResponse(order)
		return &res, nil
	}

	// Verify status with Paystack
	verification, err := s.paystackClient.VerifyTransaction(paystackRef)
	if err != nil {
		return nil, fmt.Errorf("paystack verification API request failed: %w", err)
	}

	if !verification.Status || verification.Data.Status != "success" {
		_ = s.repo.UpdateOrderPaymentStatus(ctx, order.ID, "failed")
		refreshed, err := s.repo.GetOrder(ctx, order.ID)
		if err == nil {
			order = refreshed
		}
		res := mapOrderToResponse(order)
		return &res, nil
	}

	// Double-check transaction amount matches (Paystack amount is in Kobo)
	expectedKobo := int(order.TotalAmount * 100)
	if verification.Data.Amount < expectedKobo {
		return nil, fmt.Errorf("payment mismatch: expected %d kobo, got %d kobo", expectedKobo, verification.Data.Amount)
	}

	// Update order to Paid and deduct stock counts under database transaction lock
	err = s.repo.UpdateOrderPaymentStatus(ctx, order.ID, "paid")
	if err != nil {
		return nil, fmt.Errorf("failed to update payment status: %w", err)
	}

	for _, item := range order.Items {
		err := s.repo.DeductStock(ctx, item.ProductID, item.VariantID, item.Quantity)
		if err != nil {
			// If stock deduction fails, log warning but keep order status as paid
			fmt.Printf("⚠️ WARNING: Stock deduction failed for product %s (variant %+v): %s\n", item.ProductID, item.VariantID, err.Error())
		}
	}

	// User Saved Address Auto-Save logic for future checkouts
	if order.UserID != nil && *order.UserID != "" {
		savedAddr := domain.SavedAddress{
			UserID:        *order.UserID,
			RecipientName: order.CustomerName,
			Phone:         order.CustomerPhone,
			Country:       order.ShippingCountry,
			State:         order.ShippingState,
			City:          order.ShippingCity,
			StreetAddress: order.ShippingAddress,
			PostalCode:    order.ShippingPostalCode,
		}
		// Automatically saves address in address book (ignores duplications by checking List)
		existingAddrs, _ := s.repo.ListSavedAddresses(ctx, *order.UserID)
		alreadySaved := false
		for _, addr := range existingAddrs {
			if addr.StreetAddress == savedAddr.StreetAddress && addr.City == savedAddr.City {
				alreadySaved = true
				break
			}
		}
		if !alreadySaved {
			_, _ = s.repo.SaveAddress(ctx, savedAddr)
		}
	}

	// Dispatch Resend Emails
	s.dispatchResendEmails(order)

	// Fetch refreshed order to return accurate data
	refreshed, err := s.repo.GetOrder(ctx, order.ID)
	if err == nil {
		order = refreshed
	}

	res := mapOrderToResponse(order)
	return &res, nil
}

func (s *StoreService) VerifyOrder(ctx context.Context, id string) (*dto.OrderResponse, error) {
	order, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}
	if order.PaystackReference == "" {
		return nil, fmt.Errorf("order does not have a paystack reference")
	}
	return s.VerifyPayment(ctx, order.PaystackReference)
}

func (s *StoreService) dispatchResendEmails(order *domain.Order) {
	// Build items HTML table
	var itemsHTML string
	for _, item := range order.Items {
		variantStr := ""
		if item.VariantName != "" {
			variantStr = fmt.Sprintf(" (%s: %s)", item.VariantName, item.VariantValue)
		}
		itemsHTML += fmt.Sprintf(`
			<tr>
				<td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #0A192F;">%s%s</td>
				<td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: #555;">%d</td>
				<td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #E50914;">₦%.2f</td>
			</tr>
		`, item.ProductName, variantStr, item.Quantity, item.UnitPrice*float64(item.Quantity))
	}

	// 1. Send receipt email to the Buyer
	buyerHTML := fmt.Sprintf(`
		<div style="font-family: sans-serif; color: #0A192F; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
			<div style="text-align: center; background-color: #0A192F; padding: 20px; border-radius: 6px 6px 0 0;">
				<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">SHOWTIME STORE</h1>
				<p style="color: #E50914; margin: 5px 0 0 0; font-size: 12px; font-weight: bold; letter-spacing: 1px;">OFFICIAL INVOICE & RECEIPT</p>
			</div>
			
			<div style="padding: 20px;">
				<h2 style="color: #0A192F; margin-top: 0; font-weight: 900;">Thank you for your order, %s!</h2>
				<p style="color: #555; line-height: 1.6;">We have successfully received your payment and are preparing your package. Below is a breakdown of your official receipt.</p>
				
				<div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #E50914;">
					<p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Order Reference:</strong> <span style="font-family: monospace; font-weight: bold; color: #0A192F;">%s</span></p>
					<p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Total Paid:</strong> <span style="color: #E50914; font-weight: bold;">₦%.2f</span></p>
					<p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Payment Status:</strong> <span style="background-color: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; uppercase;">PAID</span></p>
				</div>

				<h3 style="color: #0A192F; border-bottom: 2px solid #0A192F; padding-bottom: 6px; margin-bottom: 10px;">Items Purchased</h3>
				<table style="width: 100%%; border-collapse: collapse; margin-bottom: 25px;">
					<thead>
						<tr style="background-color: #f8f9fa;">
							<th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Item</th>
							<th style="padding: 8px 10px; text-align: center; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Qty</th>
							<th style="padding: 8px 10px; text-align: right; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Subtotal</th>
						</tr>
					</thead>
					<tbody>
						%s
					</tbody>
				</table>

				<h3 style="color: #0A192F; border-bottom: 2px solid #0A192F; padding-bottom: 6px; margin-bottom: 10px;">Shipping Details</h3>
				<p style="line-height: 1.6; color: #555; background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
					<strong>Recipient:</strong> %s<br>
					<strong>Street Address:</strong> %s<br>
					<strong>Location:</strong> %s, %s, %s<br>
					<strong>Postal Code:</strong> %s
				</p>

				<hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
				<p style="font-size: 11px; color: #999; text-align: center; line-height: 1.5;">
					If you have any questions or require custom modifications, please reach out to our team at support@sffl.football.<br>
					<strong>Showtime Flag Football League Lagos © 2026. All rights reserved.</strong>
				</p>
			</div>
		</div>
	`, order.CustomerName, order.OrderReference, order.TotalAmount, itemsHTML, order.CustomerName, order.ShippingAddress, order.ShippingCity, order.ShippingState, order.ShippingCountry, order.ShippingPostalCode)

	_ = SubmitJob(func() {
		if err := s.emailService.SendEmail(order.CustomerEmail, fmt.Sprintf("Order Confirmation - %s", order.OrderReference), buyerHTML); err != nil {
			fmt.Printf("⚠️ WARNING: Failed to send store purchase confirmation email to buyer %s: %s\n", order.CustomerEmail, err.Error())
		}
	})

	// 2. Send alert email to the Admin configured email
	adminEmail := os.Getenv("ADMIN_STORE_EMAIL")
	if adminEmail == "" {
		adminEmail = "store-admin@sffl.football" // sensible default SFFL admin email
	}

	adminHTML := fmt.Sprintf(`
		<div style="font-family: sans-serif; color: #0A192F; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
			<div style="background-color: #0A192F; padding: 15px; border-radius: 6px 6px 0 0; text-align: center;">
				<h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">🚨 NEW STORE ORDER</h2>
			</div>
			
			<div style="padding: 20px;">
				<p style="color: #333; font-size: 15px; line-height: 1.5;">A new storefront purchase was successfully processed on Paystack and is awaiting fulfillment.</p>
				
				<table style="width: 100%%; border-collapse: collapse; margin-bottom: 25px;">
					<tr style="background-color: #f8f9fa;">
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Order Reference</td>
						<td style="padding: 10px; border: 1px solid #ddd; font-family: monospace; font-weight: bold; color: #E50914;">%s</td>
					</tr>
					<tr>
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Customer Name</td>
						<td style="padding: 10px; border: 1px solid #ddd;">%s</td>
					</tr>
					<tr>
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Customer Email</td>
						<td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:%s" style="color: #0A192F; text-decoration: none;">%s</a></td>
					</tr>
					<tr>
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Customer Phone</td>
						<td style="padding: 10px; border: 1px solid #ddd;">%s</td>
					</tr>
					<tr>
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Amount</td>
						<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #137333;">₦%.2f</td>
					</tr>
				</table>

				<h3 style="color: #0A192F; border-bottom: 2px solid #0A192F; padding-bottom: 6px; margin-bottom: 10px;">Items to Ship</h3>
				<table style="width: 100%%; border-collapse: collapse; margin-bottom: 25px;">
					<thead>
						<tr style="background-color: #f8f9fa;">
							<th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Item</th>
							<th style="padding: 8px 10px; text-align: center; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Qty</th>
							<th style="padding: 8px 10px; text-align: right; font-size: 12px; color: #777; border-bottom: 2px solid #ddd;">Subtotal</th>
						</tr>
					</thead>
					<tbody>
						%s
					</tbody>
				</table>

				<h3 style="color: #0A192F; border-bottom: 2px solid #0A192F; padding-bottom: 6px; margin-bottom: 10px;">Fulfillment Location</h3>
				<p style="background-color: #fff9e6; padding: 15px; border-radius: 6px; line-height: 1.6; border-left: 4px solid #f0ad4e; color: #66512c; font-size: 14px;">
					<strong>Recipient:</strong> %s<br>
					<strong>Address:</strong> %s<br>
					<strong>Location:</strong> %s, %s, %s<br>
					<strong>Postal Code:</strong> %s
				</p>

				<p style="font-size: 13px; color: #555; line-height: 1.5; margin-top: 25px;">
					Please log in to your SFFL Admin Portal dashboard under the orders tab to mark this order as fulfilled once shipped.
				</p>
			</div>
		</div>
	`, order.OrderReference, order.CustomerName, order.CustomerEmail, order.CustomerEmail, order.CustomerPhone, order.TotalAmount, itemsHTML, order.CustomerName, order.ShippingAddress, order.ShippingCity, order.ShippingState, order.ShippingCountry, order.ShippingPostalCode)

	_ = SubmitJob(func() {
		if err := s.emailService.SendEmail(adminEmail, fmt.Sprintf("🚨 NEW ORDER: %s Awaiting Fulfillment", order.OrderReference), adminHTML); err != nil {
			fmt.Printf("⚠️ WARNING: Failed to send store purchase notification email to admin %s: %s\n", adminEmail, err.Error())
		}
	})
}

func (s *StoreService) GetOrder(ctx context.Context, id string) (*dto.OrderResponse, error) {
	o, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	res := mapOrderToResponse(o)
	return &res, nil
}

func (s *StoreService) GetOrderByReference(ctx context.Context, reference string) (*dto.OrderResponse, error) {
	o, err := s.repo.GetOrderByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	res := mapOrderToResponse(o)
	return &res, nil
}

func (s *StoreService) ListOrders(ctx context.Context, page, limit int, userID *string, paymentStatus *string, fulfillmentStatus *string) ([]dto.OrderResponse, int, error) {
	orders, total, err := s.repo.ListOrders(ctx, page, limit, userID, paymentStatus, fulfillmentStatus)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.OrderResponse, 0, len(orders))
	for _, o := range orders {
		detailed, err := s.repo.GetOrder(ctx, o.ID)
		if err == nil {
			o = *detailed
		}
		responses = append(responses, mapOrderToResponse(&o))
	}

	return responses, total, nil
}

func (s *StoreService) UpdateFulfillmentStatus(ctx context.Context, id string, status string) (*dto.OrderResponse, error) {
	err := s.repo.UpdateOrderFulfillmentStatus(ctx, id, status)
	if err != nil {
		return nil, err
	}

	o, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return nil, err
	}

	res := mapOrderToResponse(o)
	return &res, nil
}

func (s *StoreService) ListSavedAddresses(ctx context.Context, userID string) ([]dto.SavedAddressResponse, error) {
	list, err := s.repo.ListSavedAddresses(ctx, userID)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.SavedAddressResponse, 0, len(list))
	for _, addr := range list {
		responses = append(responses, dto.SavedAddressResponse{
			ID:            addr.ID,
			RecipientName: addr.RecipientName,
			Phone:         addr.Phone,
			Country:       addr.Country,
			State:         addr.State,
			City:          addr.City,
			StreetAddress: addr.StreetAddress,
			PostalCode:    addr.PostalCode,
		})
	}
	return responses, nil
}

func (s *StoreService) SaveAddress(ctx context.Context, userID string, req dto.SaveAddressRequest) (*dto.SavedAddressResponse, error) {
	addr := domain.SavedAddress{
		UserID:        userID,
		RecipientName: req.RecipientName,
		Phone:         req.Phone,
		Country:       req.Country,
		State:         req.State,
		City:          req.City,
		StreetAddress: req.StreetAddress,
		PostalCode:    req.PostalCode,
	}

	created, err := s.repo.SaveAddress(ctx, addr)
	if err != nil {
		return nil, err
	}

	return &dto.SavedAddressResponse{
		ID:            created.ID,
		RecipientName: created.RecipientName,
		Phone:         created.Phone,
		Country:       created.Country,
		State:         created.State,
		City:          created.City,
		StreetAddress: created.StreetAddress,
		PostalCode:    created.PostalCode,
	}, nil
}

func (s *StoreService) SaveProductVariants(ctx context.Context, productID string, req []dto.ProductVariantResponse) error {
	variants := make([]domain.ProductVariant, 0, len(req))
	for _, v := range req {
		var pricePtr *float64
		if v.Price > 0 {
			pricePtr = &v.Price
		}
		
		sku := v.SKU
		if sku == "" {
			sku = fmt.Sprintf("sku-%s-%s-%s", productID[:4], v.VariantName[:2], uuid.New().String()[:4])
		}
		
		variants = append(variants, domain.ProductVariant{
			ProductID:    productID,
			VariantName:  v.VariantName,
			VariantValue: v.VariantValue,
			SKU:          sku,
			Price:        pricePtr,
			Quantity:     v.Quantity,
		})
	}
	return s.repo.SaveProductVariants(ctx, productID, variants)
}

func (s *StoreService) SaveProductImages(ctx context.Context, productID string, req []dto.ProductImageResponse) error {
	images := make([]domain.ProductImage, 0, len(req))
	for _, img := range req {
		images = append(images, domain.ProductImage{
			ProductID:    productID,
			ImageURL:     img.ImageURL,
			IsPrimary:    img.IsPrimary,
			DisplayOrder: img.DisplayOrder,
		})
	}
	return s.repo.SaveProductImages(ctx, productID, images)
}

func (s *StoreService) CreateStoreProduct(ctx context.Context, req dto.CreateStoreProductRequest) (*dto.StoreProductResponse, error) {
	p := domain.Product{
		Name:        req.Name,
		SKU:         req.SKU,
		Description: req.Description,
		Price:       req.Price,
		Quantity:    req.Quantity,
		Threshold:   req.Threshold,
		IsActive:    req.IsActive,
	}
	created, err := s.repo.CreateStoreProduct(ctx, p)
	if err != nil {
		return nil, err
	}
	res := mapProductToStoreResponse(created)
	return &res, nil
}

func (s *StoreService) UpdateStoreProduct(ctx context.Context, id string, req dto.UpdateStoreProductRequest) error {
	p := domain.Product{
		ID:          id,
		Name:        req.Name,
		SKU:         req.SKU,
		Description: req.Description,
		Price:       req.Price,
		Quantity:    req.Quantity,
		Threshold:   req.Threshold,
		IsActive:    req.IsActive,
	}
	return s.repo.UpdateStoreProduct(ctx, p)
}

func (s *StoreService) DeleteStoreProduct(ctx context.Context, id string) error {
	return s.repo.DeleteStoreProduct(ctx, id)
}

func (s *StoreService) ListAllStoreProducts(ctx context.Context) ([]dto.StoreProductResponse, error) {
	products, err := s.repo.ListAllStoreProducts(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.StoreProductResponse, 0, len(products))
	for _, p := range products {
		responses = append(responses, mapProductToStoreResponse(&p))
	}
	return responses, nil
}

