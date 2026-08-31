// Central config for visitor analytics. Two independent trackers, because they
// answer two different questions:
//
//   • Vercel Web Analytics — "how many people came, from where, on what page".
//     Aggregate and anonymous. No config lives here: the <Analytics /> component
//     self-disables outside a Vercel deployment, and the collection endpoint is
//     switched on in the Vercel dashboard (Project → Analytics), not in code.
//
//   • Brevo tracker (this file) — "which of our *contacts* browsed what", which
//     is what makes newsletter automation possible (see NewsletterPopup). It is
//     contact-centric, so it is NOT a substitute for the traffic numbers above.
//
// The Brevo tracker stays DORMANT until VITE_BREVO_CLIENT_KEY is set, matching
// how ads and the newsletter popup are gated (see config/monetization.ts).

/**
 * Brevo tracker client key, from Brevo → Automation → Settings → Tracking code.
 * Public by design — it identifies the account to Brevo's CDN and is meant to
 * ship in client-side code, exactly like the newsletter form URL. It is NOT an
 * API key and grants no access to the Brevo account.
 */
export const BREVO_CLIENT_KEY: string = import.meta.env.VITE_BREVO_CLIENT_KEY || '';

/** Brevo only loads once a real key is configured. */
export const BREVO_TRACKING_ENABLED: boolean = BREVO_CLIENT_KEY.length > 0;
