export interface SalesByTier {
    tier_name: string;
    total_amount: number;
    quantity: number;
}

export interface AdminAnalyticsResponse {
    total_revenue: number;
    total_tickets_sold: number;
    total_users: number;
    users_by_role: Record<string, number>;
    sales_by_tier: SalesByTier[];
}

/** One match day's buyers and how many of them had bought before. */
export interface RepeatCustomerDay {
    event_day_id: string;
    title: string;
    date: string;
    buyers: number;
    returning: number;
}

/** A returning buyer for the chosen match day. */
export interface RepeatCustomer {
    name: string;
    email: string;
    phone: string;
    tickets: number;
    spent: number;
    prior_purchases: number;
    first_bought_at: string;
}

export interface RepeatCustomerReport {
    /** Every match day that sold tickets, newest first. */
    days: RepeatCustomerDay[];
    /** The match day `customers` is for. */
    event_day_id: string;
    customers: RepeatCustomer[];
}
