export interface ProductImage {
    id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
}

export interface ProductOptionValue {
    value: string;
    price?: number; // only present when the parent option drives price
}

export interface ProductOption {
    name: string;
    drives_price: boolean;
    values: ProductOptionValue[];
}

export interface ProductVariant {
    id: string;
    option1_value?: string;
    option2_value?: string;
    option3_value?: string;
    sku: string;
    quantity: number;
    price: number;      // derived server-side from the pricing option
    image_url?: string; // optional pin to a product image
}

export interface StoreProduct {
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
    images: ProductImage[];
    options: ProductOption[];
    variants: ProductVariant[];
    rating_avg: number;
    rating_count: number;
    created_by_name?: string;
    tags?: string[];
}

export interface ProductReview {
    id: string;
    product_id: string;
    user_id: string;
    user_name: string;
    verified_purchase: boolean;
    rating: number;
    title?: string;
    body?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateProductReviewPayload {
    rating: number;
    title?: string;
    body?: string;
}

export type ReviewSort = 'newest' | 'highest' | 'lowest';

export interface CheckoutItemPayload {
    product_id: string;
    variant_id?: string;
    quantity: number;
}

export interface CheckoutPayload {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_country: string;
    shipping_state: string;
    shipping_city: string;
    shipping_address: string;
    shipping_postal_code: string;
    items: CheckoutItemPayload[];
    /** Optional. An invalid code fails the checkout rather than being ignored. */
    discount_code?: string;
}

export interface CheckoutResponseData {
    order_reference: string;
    paystack_url: string;
    paystack_ref: string;
    paystack_access_code: string;
}

export interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    variant_id?: string;
    variant_label?: string; // snapshot like "Size: M, Color: Navy"
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface Order {
    id: string;
    order_reference: string;
    user_id?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_country: string;
    shipping_state: string;
    shipping_city: string;
    shipping_address: string;
    shipping_postal_code: string;
    total_amount: number;
    discount_code?: string;
    discount_amount: number;
    payment_status: 'pending' | 'paid' | 'failed';
    fulfillment_status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
    paystack_reference?: string;
    created_at: string;
    updated_at: string;
    items: OrderItem[];
}

export interface SavedAddress {
    id: string;
    recipient_name: string;
    phone: string;
    country: string;
    state: string;
    city: string;
    street_address: string;
    postal_code: string;
}

// Variant rows sent up are pure combination + stock + optional image pin —
// price is derived server-side from the product's pricing option.
export type AdminVariantPayload = {
    option1_value?: string;
    option2_value?: string;
    option3_value?: string;
    sku?: string;
    quantity: number;
    image_url?: string;
};
