package domain

import "time"

// ProductImage represents an image associated with a product
type ProductImage struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	ImageURL     string    `json:"image_url"`
	IsPrimary    bool      `json:"is_primary"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
}

// ProductVariant represents a specific variant size/format option with stock & custom SKU
type ProductVariant struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	VariantName  string    `json:"variant_name"`  // e.g. "Size", "Format"
	VariantValue string    `json:"variant_value"` // e.g. "M", "Hardcover"
	SKU          string    `json:"sku"`
	Price        *float64  `json:"price,omitempty"` // Custom override price. If nil, defaults to product base price
	Quantity     int       `json:"quantity"`        // Specific stock count for this variant
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SavedAddress represents a shipping address saved by a logged-in user
type SavedAddress struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	RecipientName string    `json:"recipient_name"`
	Phone         string    `json:"phone"`
	Country       string    `json:"country"`
	State         string    `json:"state"`
	City          string    `json:"city"`
	StreetAddress string    `json:"street_address"`
	PostalCode    string    `json:"postal_code"`
	CreatedAt     time.Time `json:"created_at"`
}

// Order represents an online storefront transaction
type Order struct {
	ID                 string      `json:"id"`
	OrderReference     string      `json:"order_reference"`
	UserID             *string     `json:"user_id,omitempty"` // Nullable for guest checkouts
	CustomerName       string      `json:"customer_name"`
	CustomerEmail      string      `json:"customer_email"`
	CustomerPhone      string      `json:"customer_phone"`
	ShippingCountry    string      `json:"shipping_country"`
	ShippingState      string      `json:"shipping_state"`
	ShippingCity       string      `json:"shipping_city"`
	ShippingAddress    string      `json:"shipping_address"`
	ShippingPostalCode string      `json:"shipping_postal_code"`
	TotalAmount        float64     `json:"total_amount"`
	PaymentStatus      string      `json:"payment_status"`     // e.g. "pending", "paid", "failed"
	FulfillmentStatus  string      `json:"fulfillment_status"`   // e.g. "pending", "shipped", "delivered"
	PaystackReference  string      `json:"paystack_reference"`
	PaystackAccessCode string      `json:"paystack_access_code"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
	Items              []OrderItem `json:"items,omitempty"`
}

// OrderItem represents a single item configuration within an online order
type OrderItem struct {
	ID           string   `json:"id"`
	OrderID      string   `json:"order_id"`
	ProductID    string   `json:"product_id"`
	VariantID    *string  `json:"variant_id,omitempty"` // Optional variant
	Quantity     int      `json:"quantity"`
	UnitPrice    float64  `json:"unit_price"`
	ProductName  string   `json:"product_name,omitempty"`
	VariantName  string   `json:"variant_name,omitempty"`
	VariantValue string   `json:"variant_value,omitempty"`
}
