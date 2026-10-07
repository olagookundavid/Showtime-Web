import type { TicketResponse } from './tickets';

export interface SalesByTier {
    tier_name: string;
    total_amount: number;
    quantity: number;
}

export interface AdminAnalyticsResponse {
    total_revenue: number;
    total_tickets_sold: number;
    total_users: number;
    recent_sales: TicketResponse[];
    users_by_role: Record<string, number>;
    sales_by_tier: SalesByTier[];
}
