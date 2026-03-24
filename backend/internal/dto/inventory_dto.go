package dto

import "time"

// Product Requests
type CreateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,min=0"`
	Quantity    int     `json:"quantity" binding:"min=0"`
	Threshold   int     `json:"threshold" binding:"min=0"`
}

type UpdateProductRequest struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Price       *float64 `json:"price,omitempty" binding:"omitempty,min=0"`
	Quantity    *int     `json:"quantity,omitempty" binding:"omitempty,min=0"`
	Threshold   *int     `json:"threshold,omitempty" binding:"omitempty,min=0"`
	IsActive    *bool    `json:"is_active,omitempty"`
}

// Sale Requests
type LogSaleRequest struct {
	ProductID     string `json:"product_id" binding:"required,uuid"`
	QuantitySold  int    `json:"quantity_sold" binding:"required,min=1"`
	PaymentMethod string `json:"payment_method" binding:"required"`
	Notes         string `json:"notes"`
}

type SaleFilters struct {
	ProductID *string `form:"product_id"`
	SellerID  *string `form:"seller_id"`
	FromDate  *string `form:"from_date"`
	ToDate    *string `form:"to_date"`
	Page      int     `form:"page" binding:"min=1"`
	Limit     int        `form:"limit" binding:"min=1,max=100"`
}

// Product Responses
type ProductResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	SKU         string    `json:"sku"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	Quantity    int       `json:"quantity"`
	Threshold   int       `json:"threshold"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Sale Responses
type SaleResponse struct {
	ID           string    `json:"id"`
	ProductID    string    `json:"product_id"`
	ProductName  string    `json:"product_name,omitempty"`
	SellerID     string    `json:"seller_id"`
	SellerName   string    `json:"seller_name"`
	QuantitySold  int       `json:"quantity_sold"`
	UnitPrice     float64   `json:"unit_price"`
	TotalAmount   float64   `json:"total_amount"`
	PaymentMethod string    `json:"payment_method"`
	Notes         string    `json:"notes"`
	SoldAt        time.Time `json:"sold_at"`
}

// Analytics / Reports
type SalesReportItem struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	UnitsSold   int     `json:"units_sold"`
	Revenue     float64 `json:"revenue"`
}

type SalesReportSeller struct {
	SellerID   string  `json:"seller_id"`
	SellerName string  `json:"seller_name"`
	UnitsSold  int     `json:"units_sold"`
	Revenue    float64 `json:"revenue"`
}

type SalesReportPaymentMethod struct {
	PaymentMethod string  `json:"payment_method"`
	Revenue       float64 `json:"revenue"`
}

type SalesReportResponse struct {
	Period       string              `json:"period"` // "daily", "weekly", "monthly"
	FromDate     time.Time           `json:"from_date"`
	ToDate       time.Time           `json:"to_date"`
	TotalRevenue float64             `json:"total_revenue"`
	TotalUnits      int                        `json:"total_units"`
	ByProduct       []SalesReportItem          `json:"by_product"`
	BySeller        []SalesReportSeller        `json:"by_seller"`
	ByPaymentMethod []SalesReportPaymentMethod `json:"by_payment_method"`
}

// Payment Methods
type CreatePaymentMethodRequest struct {
	Name string `json:"name" binding:"required"`
}

type PaymentMethodResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	IsActive  bool      `json:"is_active"`
}
