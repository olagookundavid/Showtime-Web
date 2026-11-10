import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PRIVACY_POLICY_VERSION } from '../constants';
import { readSeenPrivacyPolicyVersion, writeSeenPrivacyPolicyVersion } from '../services/privacyNotice';

// Someone already reading the policy doesn't need to be told to go read it.
const SUPPRESSED_PATHS = ['/about/privacy'];

/**
 * Drives the "Privacy Policy Updated" modal: any visitor whose stored
 * version doesn't match the current PRIVACY_POLICY_VERSION hasn't
 * acknowledged it yet — including a first-ever visit with no stored
 * value at all — and sees the notice once, until they dismiss it.
 */
export function usePrivacyPolicyNotice() {
    const [dismissedAt, setDismissedAt] = useState<string | null>(null);
    const location = useLocation();
    const routeKey = `${location.pathname}${location.search}`;
    const forceOpen = new URLSearchParams(location.search).get('privacy') === '1';
    const seen = readSeenPrivacyPolicyVersion();

    const isSuppressed = SUPPRESSED_PATHS.some(path => location.pathname.startsWith(path));
    const isOpen = dismissedAt !== routeKey && (forceOpen || (
        seen !== PRIVACY_POLICY_VERSION && !isSuppressed
    ));

    const dismiss = () => {
        writeSeenPrivacyPolicyVersion(PRIVACY_POLICY_VERSION);
        setDismissedAt(routeKey);
    };

    return { isOpen, dismiss };
}
