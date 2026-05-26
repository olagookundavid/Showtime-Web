import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Each cart line is a single (product, variant) pair with a quantity. All
// snapshot fields (name, price, image, label) are stored so the cart drawer
// can render the line without re-fetching the product. Snapshots are refreshed
// implicitly the next time a customer hits "Add to cart" on the same line.
export type CartItem = {
    product_id: string;
    variant_id?: string;
    product_name: string;
    variant_label?: string;   // e.g. "Size: M, Color: Navy"
    unit_price: number;        // snapshot at add-time
    quantity: number;
    image_url?: string;
};

type CartContextValue = {
    items: CartItem[];
    count: number;             // sum of quantities — shown on the nav badge
    subtotal: number;          // sum of unit_price * quantity
    addItem: (item: CartItem) => void;
    updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
    removeItem: (productId: string, variantId: string | undefined) => void;
    clear: () => void;
};

const STORAGE_KEY = 'showtime_cart_v1';

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Matches lines by (product_id + variant_id) — the same product with different
// variants are separate lines, but adding "M Navy" twice merges quantities.
const sameLine = (a: { product_id: string; variant_id?: string }, b: { product_id: string; variant_id?: string }) =>
    a.product_id === b.product_id && (a.variant_id || '') === (b.variant_id || '');

const loadFromStorage = (): CartItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // Defensive: drop anything missing required fields so corrupted storage
        // doesn't break the app.
        return parsed.filter((x): x is CartItem =>
            x && typeof x.product_id === 'string' && typeof x.quantity === 'number' && x.quantity > 0
        );
    } catch {
        return [];
    }
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());

    // Persist on every change. Synchronous since the cart is small and writes
    // are infrequent.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // localStorage can throw (quota, private mode) — ignore; runtime state still works.
        }
    }, [items]);

    const addItem = (incoming: CartItem) => {
        setItems(prev => {
            const idx = prev.findIndex(line => sameLine(line, incoming));
            if (idx === -1) return [...prev, incoming];
            const next = [...prev];
            // Refresh the snapshot fields too — price might have changed since
            // the customer first added it.
            next[idx] = {
                ...next[idx],
                quantity: next[idx].quantity + incoming.quantity,
                unit_price: incoming.unit_price,
                product_name: incoming.product_name,
                variant_label: incoming.variant_label,
                image_url: incoming.image_url,
            };
            return next;
        });
    };

    const updateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
        if (quantity <= 0) {
            removeItem(productId, variantId);
            return;
        }
        setItems(prev => prev.map(line => sameLine(line, { product_id: productId, variant_id: variantId }) ? { ...line, quantity } : line));
    };

    const removeItem = (productId: string, variantId: string | undefined) => {
        setItems(prev => prev.filter(line => !sameLine(line, { product_id: productId, variant_id: variantId })));
    };

    const clear = () => setItems([]);

    const count = useMemo(() => items.reduce((sum, l) => sum + l.quantity, 0), [items]);
    const subtotal = useMemo(() => items.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [items]);

    return (
        <CartContext.Provider value={{ items, count, subtotal, addItem, updateQuantity, removeItem, clear }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within a CartProvider');
    return ctx;
};
