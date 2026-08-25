/**
 * Brevo newsletter signup.
 *
 * Brevo's hosted form endpoint accepts cross-origin POSTs, so the browser can
 * talk to it directly — there's no backend involved in any of this. The URL is
 * public (it's the same one Brevo's own embed code posts to), not an API key.
 * The whole feature stays dormant while it's unset.
 */
const BREVO_FORM_URL = import.meta.env.VITE_BREVO_FORM_URL as string | undefined;

export const newsletterEnabled = !!BREVO_FORM_URL;

/** Remembers this device's answer so the popup knows to stop asking. */
export const NEWSLETTER_STORAGE_KEY = 'st_newsletter';
export const NEWSLETTER_SESSION_KEY = 'st_newsletter_seen';

export type NewsletterState = { status: 'subscribed' | 'dismissed'; at: number };

export function readNewsletterState(): NewsletterState | null {
    try {
        const raw = localStorage.getItem(NEWSLETTER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as NewsletterState;
        if (parsed?.status !== 'subscribed' && parsed?.status !== 'dismissed') return null;
        return parsed;
    } catch {
        // Private mode, disabled storage, or hand-edited garbage. Treating this
        // as "no record" means the worst case is asking again.
        return null;
    }
}

export function writeNewsletterState(status: NewsletterState['status']) {
    try {
        localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify({ status, at: Date.now() }));
    } catch {
        /* nothing we can do — the prompt will simply come back */
    }
}

/** Someone who opted in elsewhere (e.g. at ticket checkout) shouldn't then be
 *  nagged by the popup, so record it the same way the popup does. */
export function markNewsletterSubscribed() {
    writeNewsletterState('subscribed');
}

/**
 * Sends one subscription to Brevo. Never throws — callers get `false` on any
 * failure so a signup can't take down the flow it's attached to.
 *
 * Pass `keepalive` when the page is about to navigate away (the ticket flow
 * redirects to Paystack); it lets the request outlive the page instead of
 * being cancelled mid-flight.
 */
export async function subscribeToNewsletter(
    { firstName, email }: { firstName: string; email: string },
    { keepalive = false }: { keepalive?: boolean } = {},
): Promise<boolean> {
    if (!BREVO_FORM_URL) return false;

    try {
        const response = await fetch(BREVO_FORM_URL, {
            method: 'POST',
            // url-encoded keeps this a "simple" request, so there's no CORS
            // preflight round-trip before it goes out.
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                FIRSTNAME: firstName.trim(),
                EMAIL: email.trim(),
                // Brevo's honeypot — a real submission leaves it empty.
                email_address_check: '',
                locale: 'en',
            }),
            keepalive,
        });

        if (!response.ok) return false;

        markNewsletterSubscribed();
        return true;
    } catch {
        return false;
    }
}

/** Brevo's FIRSTNAME wants a given name; our accounts store a full name. */
export function toFirstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] ?? '';
}
