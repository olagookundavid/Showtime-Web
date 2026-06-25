/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Google AdSense publisher ID, e.g. ca-pub-1234567890123456. Empty = ads off. */
  readonly VITE_ADSENSE_CLIENT_ID: string;
  /** Master ad switch. Ads only render when this is the string "true". */
  readonly VITE_ADS_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// AdSense pushes ad requests onto this global queue once its script loads.
interface Window {
  adsbygoogle: unknown[];
}
