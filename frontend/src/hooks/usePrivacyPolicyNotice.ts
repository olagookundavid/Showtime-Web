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
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Escape hatch for testing/demoing: ?privacy=1 opens it immediately,
        // ignoring the stored version and the suppressed-path guard.
        if (new URLSearchParams(location.search).get('privacy') === '1') {
            setIsOpen(true);
            return;
        }

        const seen = readSeenPrivacyPolicyVersion();

        if (seen === null) {
            writeSeenPrivacyPolicyVersion(PRIVACY_POLICY_VERSION);
            return;
        }

        if (seen === PRIVACY_POLICY_VERSION) return;
        if (SUPPRESSED_PATHS.some(path => location.pathname.startsWith(path))) return;

        setIsOpen(true);
    }, [location.pathname, location.search]);

    const dismiss = () => {
        writeSeenPrivacyPolicyVersion(PRIVACY_POLICY_VERSION);
        setIsOpen(false);
    };

    return { isOpen, dismiss };
}
