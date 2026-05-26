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

// ProductOptionValue is a single allowed value of a product option, plus the
// optional price tied to it (only meaningful when the parent option drives
// price for the product).
type ProductOptionValue struct {
	Value string   `json:"value"`
	Price *float64 `json:"price,omitempty"`
}

// ProductOption defines one of (up to 3) option dimensions on a product, e.g.
// "Size" with values S/M/L. At most one option per product may have
// DrivesPrice=true; that option's per-value price overrides the product base.
type ProductOption struct {
	Name        string               `json:"name"`
	DrivesPrice bool                 `json:"drives_price"`
	Values      []ProductOptionValue `json:"values"`
}

// ProductVariant is one concrete combination of option values (e.g.
// Size=M, Color=Navy). Each combination has its own SKU, stock, and may pin
// the gallery to a specific product image when selected.
type ProductVariant struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	Option1Value string    `json:"option1_value,omitempty"`
	Option2Value string    `json:"option2_value,omitempty"`
	Option3Value string    `json:"option3_value,omitempty"`
	SKU          string    `json:"sku"`
	Quantity     int       `json:"quantity"`
	ImageURL     string    `json:"image_url,omitempty"` // optional pointer to one of the product's gallery images
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

// ProductReview is a customer-written rating on a storefront product. Only
// customers with a paid order containing the product can post one; one review
// per (product, user) is enforced at the DB level.
type ProductReview struct {
	ID            string    `json:"id"`
	ProductID     string    `json:"product_id"`
	UserID        string    `json:"user_id"`
	OrderID       *string   `json:"order_id,omitempty"`
	UserName      string    `json:"user_name,omitempty"` // joined from users table at read time
	Rating        int       `json:"rating"`
	Title         string    `json:"title,omitempty"`
	Body          string    `json:"body,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// OrderItem represents a single item configuration within an online order.
// VariantLabel is a snapshot of the human-readable variant tuple at the time
// the order was placed (e.g. "Size: M, Color: Navy") so receipts stay intact
// even if the admin later edits the product's options.
type OrderItem struct {
	ID           string  `json:"id"`
	OrderID      string  `json:"order_id"`
	ProductID    string  `json:"product_id"`
	VariantID    *string `json:"variant_id,omitempty"`
	Quantity     int     `json:"quantity"`
	UnitPrice    float64 `json:"unit_price"`
	ProductName  string  `json:"product_name,omitempty"`
	VariantLabel string  `json:"variant_label,omitempty"`
}
