/**
 * Narrows an axios rejection to the two fields the player portal reads off it,
 * so the call sites don't each need their own `any`.
 */
export function apiError(err: unknown): { code?: string; error?: string } {
    return (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data ?? {};
}
