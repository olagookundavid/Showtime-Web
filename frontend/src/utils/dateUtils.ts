/**
 * Standardized Date and Time formatting utilities for Showtime Flag Football League.
 * All match kickoff times are standardized to Lagos Time (WAT / West Africa Time, UTC+1).
 */

/**
 * Formats a match start time to Lagos Time (WAT, UTC+1).
 * Example: "15:00:00" or "2026-08-27T15:00:00Z" -> "3:00 PM"
 * Handles "15:00:00", "2026-08-27T15:00:00Z", "15:00", and fallback "TBD".
 */
export function formatMatchTime(timeString?: string | null, _dateString?: string | null): string {
    if (!timeString) return 'TBD';

    const clean = timeString.trim();
    if (
        clean === '' ||
        clean === '00:00:00' ||
        clean === '00:00' ||
        clean.includes('T00:00:00') ||
        clean.startsWith('0001-01-01')
    ) {
        return 'TBD';
    }

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
