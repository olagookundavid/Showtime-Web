package domain

import "time"

// Product represents an item in the inventory or storefront catalog.
type Product struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	SKU         string           `json:"sku"`
	Description string           `json:"description"`
	Price       float64          `json:"price"`
	Quantity    int              `json:"quantity"`
	Threshold   int              `json:"threshold"`
	IsActive    bool             `json:"is_active"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	Images        []ProductImage   `json:"images,omitempty"`
	Variants      []ProductVariant `json:"variants,omitempty"`
	Options       []ProductOption  `json:"options,omitempty"` // storefront only
	RatingAvg     float64          `json:"rating_avg"`
	RatingCount   int              `json:"rating_count"`
	CreatedBy     *string          `json:"created_by,omitempty"`      // admin user id
	CreatedByName string           `json:"created_by_name,omitempty"` // joined display name
	Tags          []string         `json:"tags"`
}

// PriceForVariant returns the active price for the given variant, honouring
// the product's pricing option (drives_price). Falls back to product.Price
// when no option drives price or the variant's pricing value isn't found.
func (p *Product) PriceForVariant(v *ProductVariant) float64 {
	if v == nil {
		return p.Price
	}
	for i, opt := range p.Options {
		if !opt.DrivesPrice {
			continue
		}
		var selected string
		switch i {
		case 0:
			selected = v.Option1Value
		case 1:
			selected = v.Option2Value
		case 2:
			selected = v.Option3Value
		}
		for _, val := range opt.Values {
			if val.Value == selected && val.Price != nil {
				return *val.Price
			}
		}
	}
	return p.Price
}

// Sale represents a record of a sale event
type Sale struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	ProductName  string    `json:"product_name,omitempty"` // Joined from inventory_products table
	SellerID     string    `json:"seller_id"`
	SellerName   string    `json:"seller_name"` // Joined from users table
	QuantitySold  int       `json:"quantity_sold"`
	UnitPrice     float64   `json:"unit_price"`   // Snapshot of price at time of sale
	TotalAmount   float64   `json:"total_amount"` // Calculated: QuantitySold * UnitPrice
	PaymentMethod string    `json:"payment_method"`
	Notes         string    `json:"notes"`
	SoldAt        time.Time `json:"sold_at"`
}

type PaymentMethod struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
