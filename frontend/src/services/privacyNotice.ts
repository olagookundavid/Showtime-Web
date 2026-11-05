/** Remembers the last Privacy Policy version this device has acknowledged,
 *  so the update notice only shows to visitors who saw an older one. */
const STORAGE_KEY = 'st_privacy_policy_seen';

export function readSeenPrivacyPolicyVersion(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private mode, disabled storage, or similar. Treating this as "no
        // record" means the worst case is the notice coming back.
        return null;
    }
}

export function writeSeenPrivacyPolicyVersion(version: string) {
    try {
        localStorage.setItem(STORAGE_KEY, version);
    } catch {
        /* nothing we can do — the notice will simply come back */
    }
}
