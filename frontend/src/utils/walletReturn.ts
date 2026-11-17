// Where to send someone after a wallet top-up that started from a checkout. The
// path survives the round trip to Paystack in sessionStorage (this tab only).

const KEY = 'showtime:wallet-return';

/** Same-site paths only: anything else would make the link an open redirect. */
const isSafePath = (path: string) => path.startsWith('/') && !path.startsWith('//');

/**
 * Remember where a top-up started from, or forget it (null) when a top-up is
 * started from the wallet page itself, so an old checkout is never offered.
 */
export function rememberWalletReturn(path: string | null): void {
    try {
        if (path && isSafePath(path)) sessionStorage.setItem(KEY, path);
        else sessionStorage.removeItem(KEY);
    } catch {
        // Storage blocked (private mode): the confirm page just links to the wallet.
    }
}

/** The remembered path, or null. */
export function readWalletReturn(): string | null {
    try {
        const path = sessionStorage.getItem(KEY);
        return path && isSafePath(path) ? path : null;
    } catch {
        return null;
    }
}
