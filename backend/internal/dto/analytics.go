package dto

type SalesByTier struct {
	TierName    string `json:"tier_name"`
	TotalAmount int    `json:"total_amount"`
	Quantity    int    `json:"quantity"`
}

type AdminAnalyticsResponse struct {
	TotalRevenue     int              `json:"total_revenue"`
	TotalTicketsSold int              `json:"total_tickets_sold"`
	TotalUsers       int              `json:"total_users"`
	RecentSales      []TicketResponse `json:"recent_sales"`
	UsersByRole      map[string]int   `json:"users_by_role"`
	SalesByTier      []SalesByTier    `json:"sales_by_tier"`
}
