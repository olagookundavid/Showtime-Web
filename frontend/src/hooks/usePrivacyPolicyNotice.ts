import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PRIVACY_POLICY_VERSION } from '../constants';
import { readSeenPrivacyPolicyVersion, writeSeenPrivacyPolicyVersion } from '../services/privacyNotice';

// Someone already reading the policy doesn't need to be told to go read it.
const SUPPRESSED_PATHS = ['/about/privacy'];

/**
 * Drives the "Privacy Policy Updated" modal: a browser with no stored record
 * is either a first-ever visit or one that predates this feature — neither
 * has an older version to have missed, so it's silently marked current
 * instead of shown the notice. Only a browser whose stored version is older
 * than `PRIVACY_POLICY_VERSION` (a genuine returning visitor) sees it.
 */
export function usePrivacyPolicyNotice() {
    const [dismissedAt, setDismissedAt] = useState<string | null>(null);
    const location = useLocation();
    const routeKey = `${location.pathname}${location.search}`;
    const forceOpen = new URLSearchParams(location.search).get('privacy') === '1';
    const seen = readSeenPrivacyPolicyVersion();

    useEffect(() => {
        // A first visit has no older version to have missed.
        if (!forceOpen && seen === null) {
            writeSeenPrivacyPolicyVersion(PRIVACY_POLICY_VERSION);
        }
    }, [forceOpen, seen]);

    const isSuppressed = SUPPRESSED_PATHS.some(path => location.pathname.startsWith(path));
    const isOpen = dismissedAt !== routeKey && (forceOpen || (
        seen !== null && seen !== PRIVACY_POLICY_VERSION && !isSuppressed
    ));

    const dismiss = () => {
        writeSeenPrivacyPolicyVersion(PRIVACY_POLICY_VERSION);
        setDismissedAt(routeKey);
    };

    return { isOpen, dismiss };
}
