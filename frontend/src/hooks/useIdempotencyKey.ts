import { useCallback, useRef } from 'react';
import { newIdempotencyKey, shouldKeepIdempotencyKey } from '../services/idempotency';

/**
 * One idempotency key per attempt at a money-moving request (a checkout, a
 * top-up, a transfer). Send `current()` with the request and call `settle` when
 * it ends: on success, or with the error when it fails. A request whose answer
 * never arrived keeps its key, so pressing the button again replays that attempt
 * on the server instead of paying twice; any real answer starts a new attempt.
 */
export function useIdempotencyKey() {
    const key = useRef<string | null>(null);

    const current = useCallback(() => {
        if (!key.current) key.current = newIdempotencyKey();
        return key.current;
    }, []);

    const settle = useCallback((err?: unknown) => {
        if (err !== undefined && shouldKeepIdempotencyKey(err)) return;
        key.current = null;
    }, []);

    return { current, settle };
}
