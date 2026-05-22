import type { StoreProduct, ProductVariant } from '../services/api';

// Total purchasable stock for a product. When variants exist the base
// product.quantity is irrelevant — only the sum of variant stock matters.
export const getAvailableStock = (product: StoreProduct): number => {
    if (product.variants && product.variants.length > 0) {
        return product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    }
    return product.quantity || 0;
};

export const isProductSoldOut = (product: StoreProduct): boolean => {
    return getAvailableStock(product) === 0;
};

// Effective unit price for a variant: server-derived `variant.price`, falling
// back to product base if the variant didn't carry one.
export const getVariantPrice = (product: StoreProduct, variant?: ProductVariant | null): number => {
    if (variant && variant.price && variant.price > 0) return variant.price;
    return product.price;
};

// Returns the variant's option values as an ordered tuple, dropping empty
// slots so a single-option product yields a 1-tuple.
export const variantValues = (variant: ProductVariant): string[] => {
    return [variant.option1_value, variant.option2_value, variant.option3_value]
        .filter((v): v is string => !!v && v.length > 0);
};

// "Size: M, Color: Navy" — composed from the product's option names and the
// variant's option values. Matches the snapshot stored in OrderItem.variant_label.
export const formatVariantLabel = (product: StoreProduct, variant: ProductVariant | null | undefined): string => {
    if (!variant) return '';
    const values = [variant.option1_value, variant.option2_value, variant.option3_value];
    const parts: string[] = [];
    for (let i = 0; i < 3; i++) {
        const val = values[i];
        if (!val) continue;
        const name = product.options?.[i]?.name || `Option ${i + 1}`;
        parts.push(`${name}: ${val}`);
    }
    return parts.join(', ');
};

// Finds the variant row matching the selected option values (keyed by option
// position 0/1/2). Returns null when no exact match exists.
export const findVariantByValues = (
    product: StoreProduct,
    selected: (string | undefined)[]
): ProductVariant | null => {
    if (!product.variants || product.variants.length === 0) return null;
    return product.variants.find(v => {
        return [v.option1_value, v.option2_value, v.option3_value].every((val, i) => {
            const sel = selected[i];
            if (!val && !sel) return true;
            return val === sel;
        });
    }) || null;
};
