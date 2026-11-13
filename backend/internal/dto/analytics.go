package dto

type SalesByTier struct {
	TierName    string `json:"tier_name"`
	TotalAmount int    `json:"total_amount"`
	Quantity    int    `json:"quantity"`
}

type AdminAnalyticsResponse struct {
	TotalRevenue     int            `json:"total_revenue"`
	TotalTicketsSold int            `json:"total_tickets_sold"`
	TotalUsers       int            `json:"total_users"`
	UsersByRole      map[string]int `json:"users_by_role"`
	SalesByTier      []SalesByTier  `json:"sales_by_tier"`
}

// RepeatCustomerDay is one match day's buyers and how many had bought before.
type RepeatCustomerDay struct {
	EventDayID string `json:"event_day_id"`
	Title      string `json:"title"`
	Date       string `json:"date"`
	Buyers     int    `json:"buyers"`
	Returning  int    `json:"returning"`
}

// RepeatCustomer is a returning buyer for the chosen match day.
type RepeatCustomer struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Phone          string `json:"phone"`
	Tickets        int    `json:"tickets"`
	Spent          int    `json:"spent"`
	PriorPurchases int    `json:"prior_purchases"`
	FirstBoughtAt  string `json:"first_bought_at"`
}

// RepeatCustomerReport is the dashboard's weekly look at returning customers.
type RepeatCustomerReport struct {
	// Days is every match day that sold tickets, newest first.
	Days []RepeatCustomerDay `json:"days"`
	// EventDayID is the match day Customers is for.
	EventDayID string           `json:"event_day_id"`
	Customers  []RepeatCustomer `json:"customers"`
}
