package dto

import "time"

// ProductImageResponse represents image metadata for storefront listings
type ProductImageResponse struct {
	ID           string `json:"id"`
	ImageURL     string `json:"image_url"`
	IsPrimary    bool   `json:"is_primary"`
	DisplayOrder int    `json:"display_order"`
}

// ProductVariantResponse represents size/format option configuration for storefront purchases
type ProductVariantResponse struct {
	ID           string   `json:"id"`
	VariantName  string   `json:"variant_name"`
	VariantValue string   `json:"variant_value"`
	SKU          string   `json:"sku"`
	Price        float64  `json:"price"` // Custom override price or product base price
	Quantity     int      `json:"quantity"`
}

// StoreProductResponse represents a deeply populated storefront product
type StoreProductResponse struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	SKU         string                   `json:"sku"`
	Description string                   `json:"description"`
	Price       float64                  `json:"price"` // Base product price
	Quantity    int                      `json:"quantity"` // Global inventory aggregate or legacy count
	Threshold   int                      `json:"threshold"`
	IsActive    bool                     `json:"is_active"`
	CreatedAt   time.Time                `json:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at"`
	Images      []ProductImageResponse   `json:"images"`
	Variants    []ProductVariantResponse `json:"variants"`
}

// SaveAddressRequest represents payload for users creating or saving shipping locations
type SaveAddressRequest struct {
	RecipientName string `json:"recipient_name" binding:"required"`
	Phone         string `json:"phone" binding:"required"`
	Country       string `json:"country" binding:"required"`
	State         string `json:"state" binding:"required"`
	City          string `json:"city" binding:"required"`
	StreetAddress string `json:"street_address" binding:"required"`
	PostalCode    string `json:"postal_code"`
}

// SavedAddressResponse represents profile saved shipping locations
type SavedAddressResponse struct {
	ID            string `json:"id"`
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	Country       string `json:"country"`
	State         string `json:"state"`
	City          string `json:"city"`
	StreetAddress string `json:"street_address"`
	PostalCode    string `json:"postal_code"`
}

// OrderItemRequest represents single merchandise in checkout cart
type OrderItemRequest struct {
	ProductID string  `json:"product_id" binding:"required,uuid"`
	VariantID *string `json:"variant_id" binding:"omitempty,uuid"` // Optional variant selection
	Quantity  int     `json:"quantity" binding:"required,min=1"`
}

// CheckoutRequest represents client billing and delivery order package
type CheckoutRequest struct {
	CustomerName       string             `json:"customer_name" binding:"required"`
	CustomerEmail      string             `json:"customer_email" binding:"required,email"`
	CustomerPhone      string             `json:"customer_phone" binding:"required"`
	ShippingCountry    string             `json:"shipping_country" binding:"required"`
	ShippingState      string             `json:"shipping_state" binding:"required"`
	ShippingCity       string             `json:"shipping_city" binding:"required"`
	ShippingAddress    string             `json:"shipping_address" binding:"required"`
	ShippingPostalCode string             `json:"shipping_postal_code"`
	Items              []OrderItemRequest `json:"items" binding:"required,dive,required"`
}

// CheckoutResponse represents initialized Paystack payment parameters
type CheckoutResponse struct {
	OrderReference     string `json:"order_reference"`
	PaystackURL        string `json:"paystack_url"`
	PaystackRef        string `json:"paystack_ref"`
	PaystackAccessCode string `json:"paystack_access_code"`
}

// OrderItemResponse represents e-commerce invoice line details
type OrderItemResponse struct {
	ID           string   `json:"id"`
	ProductID    string   `json:"product_id"`
	ProductName  string   `json:"product_name"`
	VariantID    *string  `json:"variant_id,omitempty"`
	VariantName  string   `json:"variant_name,omitempty"`
	VariantValue string   `json:"variant_value,omitempty"`
	Quantity     int      `json:"quantity"`
	UnitPrice    float64  `json:"unit_price"`
	TotalPrice   float64  `json:"total_price"`
}

// OrderResponse represents full storefront purchase package
type OrderResponse struct {
	ID                 string              `json:"id"`
	OrderReference     string              `json:"order_reference"`
	UserID             *string             `json:"user_id,omitempty"`
	CustomerName       string              `json:"customer_name"`
	CustomerEmail      string              `json:"customer_email"`
	CustomerPhone      string              `json:"customer_phone"`
	ShippingCountry    string              `json:"shipping_country"`
	ShippingState      string              `json:"shipping_state"`
	ShippingCity       string              `json:"shipping_city"`
	ShippingAddress    string              `json:"shipping_address"`
	ShippingPostalCode string              `json:"shipping_postal_code"`
	TotalAmount        float64             `json:"total_amount"`
	PaymentStatus      string              `json:"payment_status"`
	FulfillmentStatus  string              `json:"fulfillment_status"`
	PaystackReference  string              `json:"paystack_reference,omitempty"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
	Items              []OrderItemResponse `json:"items"`
}

// UpdateFulfillmentRequest represents dashboard status changes
type UpdateFulfillmentRequest struct {
	FulfillmentStatus string `json:"fulfillment_status" binding:"required,oneof=pending shipped delivered"`
}

// CreateStoreProductRequest represents payload for admin creating storefront products
type CreateStoreProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	SKU         string  `json:"sku"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,min=0"`
	Quantity    int     `json:"quantity" binding:"min=0"`
	Threshold   int     `json:"threshold" binding:"min=0"`
	IsActive    bool    `json:"is_active"`
}

// UpdateStoreProductRequest represents payload for admin updating storefront products
type UpdateStoreProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	SKU         string  `json:"sku"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,min=0"`
	Quantity    int     `json:"quantity" binding:"min=0"`
	Threshold   int     `json:"threshold" binding:"min=0"`
	IsActive    bool    `json:"is_active"`
}

