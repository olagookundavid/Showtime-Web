// Central config + slot registry for Google AdSense.
//
// Everything here stays DORMANT until both are true:
//   1. VITE_ADSENSE_CLIENT_ID is set to a real ca-pub-XXXX publisher ID, and
//   2. VITE_ADS_ENABLED === "true"  (see frontend/.env)
//
// Until then <AdSenseScript /> injects nothing and every <GoogleAd /> renders
// null, so dev and pre-approval builds stay completely ad-free.

export const ADSENSE_CLIENT_ID: string = import.meta.env.VITE_ADSENSE_CLIENT_ID || '';

// Ads only render when explicitly enabled AND a real publisher ID is present.
// Kept off by default so we never click our own ads in dev — AdSense bans
// accounts for "invalid traffic", and a dev fat-fingering an ad is enough.
export const ADS_ENABLED: boolean =
    import.meta.env.VITE_ADS_ENABLED === 'true' && ADSENSE_CLIENT_ID.startsWith('ca-pub-');

// Ad-unit slot IDs from the AdSense dashboard (Ads → By ad unit → Display ads).
// Each placement gets its own unit so reporting is per-location. Fill in the
// numeric data-ad-slot ID once each unit is created; an empty value means that
// placement is skipped (GoogleAd renders null), so it's safe to roll them out
// one at a time.
export const AD_SLOTS = {
    newsFeed: '',       // in-feed unit between news cards (NewsList)
    newsArticle: '',    // in-article unit on a news detail page (NewsDetail)
    matchesFeed: '',    // matches hub (MatchHub)
    matchDetail: '',    // match detail page (MatchDetail)
    standings: '',      // standings table page (StandingsPage)
    stats: '',          // stats page (StatsPage)
    playerDetail: '',   // player profile (PlayerDetail)
    teamDetail: '',     // team page (TeamDetail)
    gallery: '',        // gallery page (GalleryPage)
    landing: '',        // homepage (LandingPage) — keep below the fold
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;
