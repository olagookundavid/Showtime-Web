import { useEffect, useRef, useState } from 'react';

/** React Query key for an edition's fan vote in the admin. */
export const potwPollQueryKey = (totwId: string) => ['adminPOTWPoll', totwId];

/**
 * The current time, refreshed every `intervalMs`. Components read time through
 * this instead of calling Date.now() while rendering.
 */
export function useNow(intervalMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}

/**
 * Milliseconds left until `target`, ticking every second. `serverTime` is the
 * server's clock when the data was fetched; the gap to the device clock is
 * applied so a phone set to the wrong time still counts down correctly.
 * Calls `onElapsed` once when the countdown reaches zero.
 */
export function useServerCountdown(target: string, serverTime: string, onElapsed?: () => void): number {
    const targetMs = Date.parse(target);
    const serverMs = Date.parse(serverTime);
    // Exact at fetch time; the interval below keeps it current.
    const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - serverMs));

    const elapsedRef = useRef(onElapsed);
    useEffect(() => {
        elapsedRef.current = onElapsed;
    }, [onElapsed]);

    useEffect(() => {
        const offset = serverMs - Date.now();
        let fired = false;
        const id = window.setInterval(() => {
            const left = Math.max(0, targetMs - (Date.now() + offset));
            setRemaining(left);
            if (left === 0 && !fired) {
                fired = true;
                elapsedRef.current?.();
            }
        }, 1000);
        return () => window.clearInterval(id);
    }, [targetMs, serverMs]);

    return remaining;
}

export function splitDuration(ms: number) {
    const total = Math.floor(ms / 1000);
    return {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
    };
}

/** Plain-words time left for screen readers, e.g. "2 days 4 hours". */
export function describeRemaining(ms: number): string {
    const { days, hours, minutes } = splitDuration(ms);
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (days > 0) return `${plural(days, 'day')} ${plural(hours, 'hour')}`;
    if (hours > 0) return `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`;
    if (minutes > 0) return plural(minutes, 'minute');
    return 'less than a minute';
}
