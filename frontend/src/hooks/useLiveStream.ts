import { useQuery } from '@tanstack/react-query';
import { getLiveStatus } from '../services/api';

/** How often every client re-asks whether the channel is live. The backend
 *  caches detection for 45s, so this is one YouTube hit per minute regardless
 *  of how many people are on the site. */
const POLL_MS = 60_000;

/** Shared live-stream state. The landing hero and the navbar badge both call
 *  this — one query key means one poll and one cache entry, not two. */
export const useLiveStream = () => {
    const { data } = useQuery({
        queryKey: ['liveStatus'],
        queryFn: getLiveStatus,
        refetchInterval: POLL_MS,
        // A visitor returning to the tab should see the stream immediately
        // rather than waiting out the rest of the interval.
        refetchOnWindowFocus: true,
        // Never surface a failed poll as an error state — the site simply
        // stays on the carousel.
        retry: 1,
    });

    return {
        isLive: Boolean(data?.is_live && data.video_id),
        videoId: data?.video_id,
        title: data?.title,
    };
};
