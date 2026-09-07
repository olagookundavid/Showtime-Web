import { useEffect, useState } from 'react';

/**
 * Holds a value back until the user stops changing it.
 *
 * Used for search boxes that drive a server query: every keystroke would
 * otherwise be its own request, and the answers can arrive out of order.
 */
export function useDebounced<T>(value: T, ms = 350): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}
