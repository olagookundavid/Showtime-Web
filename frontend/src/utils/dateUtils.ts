/**
 * Standardized Date and Time formatting utilities for Showtime Flag Football League.
 * All match kickoff times are standardized to Lagos Time (WAT / West Africa Time, UTC+1).
 */

/**
 * True when a match start_time value is a placeholder for "kickoff time not
 * yet set" rather than a real time — covers the empty string, the zero-value
 * time-of-day, and the Go zero-value timestamp the backend sends for an unset
 * start time. Shared by every function below so "is this time TBD" can't
 * drift between them.
 */
function isTBDTime(timeString?: string | null): boolean {
    if (!timeString) return true;
    const clean = timeString.trim();
    return (
        clean === '' ||
        clean === '00:00:00' ||
        clean === '00:00' ||
        clean.includes('T00:00:00') ||
        clean.startsWith('0001-01-01')
    );
}

/**
 * Today's date in Lagos time as "YYYY-MM-DD". Match days are dated in WAT, so
 * a visitor in another timezone must not shift which day counts as today.
 */
export function lagosToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

/**
 * Formats a match start time to Lagos Time (WAT, UTC+1).
 * Example: "15:00:00" or "2026-08-27T15:00:00Z" -> "3:00 PM"
 * Handles "15:00:00", "2026-08-27T15:00:00Z", "15:00", and fallback "TBD".
 */
export function formatMatchTime(timeString?: string | null, _dateString?: string | null): string {
    if (isTBDTime(timeString)) return 'TBD';
    const clean = (timeString as string).trim();

    // Extract time portion if it's an ISO timestamp
    let rawTime = clean;
    if (clean.includes('T')) {
        const parts = clean.split('T');
        if (parts[1]) {
            rawTime = parts[1].split('Z')[0].split('+')[0];
        }
    }

    // rawTime is now "HH:MM:SS" or "HH:MM"
    const timeParts = rawTime.split(':');
    if (timeParts.length < 2) return 'TBD';

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return 'TBD';
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 'TBD';

    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const minStr = minutes.toString().padStart(2, '0');

    return `${hour12}:${minStr} ${period}`;
}

/**
 * Formats a match date consistently across the site.
 * Example: "2026-08-27T00:00:00Z" -> "Thu, Aug 27" or "Thursday, 27 August 2026"
 */
export function formatMatchDate(
    dateString?: string | null,
    options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string {
    if (!dateString) return '';
    try {
        const datePart = dateString.split('T')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            if (year && month && day) {
                const dateObj = new Date(year, month - 1, day);
                return dateObj.toLocaleDateString('en-US', options);
            }
        }
        return new Date(dateString).toLocaleDateString('en-US', options);
    } catch {
        return dateString.split('T')[0];
    }
}

/**
 * Resolves the match kickoff timestamp in West Africa Time (WAT, UTC+1).
 */
export function getMatchKickoffTime(dateString?: string | null, timeString?: string | null): Date | null {
    if (!dateString) return null;
    const datePart = dateString.split('T')[0];
    if (!datePart || !datePart.includes('-')) return null;

    let timePart = '00:00:00';
    if (timeString && !isTBDTime(timeString)) {
        const clean = timeString.trim();
        if (clean.includes('T')) {
            const parts = clean.split('T');
            if (parts[1]) {
                timePart = parts[1].split('Z')[0].split('+')[0];
            }
        } else {
            timePart = clean;
        }
    }

    const tParts = timePart.split(':');
    const hh = (tParts[0] || '00').padStart(2, '0');
    const mm = (tParts[1] || '00').padStart(2, '0');
    const ss = (tParts[2] || '00').padStart(2, '0');

    // Africa/Lagos is UTC+1 year-round (no DST)
    const isoString = `${datePart}T${hh}:${mm}:${ss}+01:00`;
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks whether a match team sheet is locked (e.g. 10 minutes prior to kickoff, LIVE, or FINISHED).
 */
export function isMatchLocked(
    match?: { status?: string; date?: string; start_time?: string } | null,
    minutesBefore = 10
): boolean {
    if (!match) return false;
    if (match.status === 'FINISHED' || match.status === 'LIVE') return true;
    // A postponed match keeps its old date/time until rescheduled, so it must
    // never be treated as locked by a kickoff that's no longer happening.
    if (match.status === 'POSTPONED') return false;

    const kickoff = getMatchKickoffTime(match.date, match.start_time);
    if (!kickoff) return false;

    // Check if a specific kickoff time was provided (not TBD)
    const hasSpecificTime = !isTBDTime(match.start_time);

    if (hasSpecificTime) {
        const lockThreshold = kickoff.getTime() - minutesBefore * 60 * 1000;
        return Date.now() >= lockThreshold;
    } else {
        // If TBD, locks at the end of the match date in Lagos time (23:59:59 +01:00)
        const datePart = match.date?.split('T')[0];
        const endOfDay = new Date(`${datePart}T23:59:59+01:00`);
        return !isNaN(endOfDay.getTime()) && Date.now() > endOfDay.getTime();
    }
}

/**
 * Returns formatted lock countdown information for a match.
 */
export function getMatchLockCountdown(
    match?: { status?: string; date?: string; start_time?: string } | null,
    minutesBefore = 10
): { isLocked: boolean; label: string; lockTime: Date | null } {
    if (!match) return { isLocked: false, label: '', lockTime: null };
    if (match.status === 'FINISHED') {
        return { isLocked: true, label: 'Match finished · Team sheet locked', lockTime: null };
    }
    if (match.status === 'LIVE') {
        return { isLocked: true, label: 'Match live · Team sheet locked', lockTime: null };
    }
    if (match.status === 'POSTPONED') {
        return { isLocked: false, label: 'Postponed · awaiting new date', lockTime: null };
    }

    const kickoff = getMatchKickoffTime(match.date, match.start_time);
    if (!kickoff) return { isLocked: false, label: '', lockTime: null };

    const hasSpecificTime = !isTBDTime(match.start_time);

    if (!hasSpecificTime) {
        const isPast = isMatchLocked(match, minutesBefore);
        return {
            isLocked: isPast,
            label: isPast ? 'Match date passed · Team sheet locked' : 'Kickoff time TBD',
            lockTime: null,
        };
    }

    const lockThreshold = kickoff.getTime() - minutesBefore * 60 * 1000;
    const lockDate = new Date(lockThreshold);
    const now = Date.now();
    const diffMs = lockThreshold - now;

    if (diffMs <= 0) {
        return {
            isLocked: true,
            label: 'Locked (10m pre-match)',
            lockTime: lockDate,
        };
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let countdown = '';
    if (diffDays > 0) {
        countdown = `Locks in ${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
        countdown = `Locks in ${diffHours}h ${diffMins % 60}m`;
    } else {
        countdown = `Locks in ${diffMins}m`;
    }

    return {
        isLocked: false,
        label: countdown,
        lockTime: lockDate,
    };
}

