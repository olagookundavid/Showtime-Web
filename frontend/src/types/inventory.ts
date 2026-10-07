export interface InventoryProduct {
    id: string;
    name: string;
    sku: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface InventorySale {
    id: string;
    product_id: string;
    product_name: string;
    seller_id: string;
    seller_name: string;
    quantity_sold: number;
    unit_price: number;
    total_amount: number;
    payment_method: string;
    notes: string;
    sold_at: string;
}

export interface SalesReportResponse {
    period: string; // daily, weekly, monthly
    from_date: string;
    to_date: string;
    total_revenue: number;
    total_units: number;
    by_product: {
        product_id: string;
        product_name: string;
        units_sold: number;
        revenue: number;
    }[];
    by_seller: {
        seller_id: string;
        seller_name: string;
        units_sold: number;
        revenue: number;
    }[];
    by_payment_method: {
        payment_method: string;
        revenue: number;
    }[];
}

export interface PaymentMethod {
    id: string;
    name: string;
    is_active: boolean;
}
