// URL helpers for the embeds an article body can carry: YouTube videos and
// news reference cards (see components/richtext/RichContent.tsx).

export interface NewsRefData {
    url: string;
    isInternal: boolean;
    slug?: string;
    domain?: string;
}

/** Parses a URL or path to determine if it is an internal news article link or an external news page. */
export const parseNewsRefUrl = (input: string): NewsRefData | null => {
    const trimmed = (input || '').trim();
    if (!trimmed) return null;

    // Check relative internal path e.g. /news/slug or news/slug
    const relativeMatch = trimmed.match(/^(?:\/)?news\/([a-zA-Z0-9_-]+)\/?$/);
    if (relativeMatch) {
        return {
            url: `/news/${relativeMatch[1]}`,
            isInternal: true,
            slug: relativeMatch[1],
        };
    }

    try {
        const hasProtocol = /^https?:\/\//i.test(trimmed);
        const parsed = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
        const newsPathMatch = parsed.pathname.match(/^\/news\/([a-zA-Z0-9_-]+)\/?$/);

        const currentHost = typeof window !== 'undefined' ? window.location.host : '';
        const cleanHost = parsed.hostname.replace(/^www\./, '');
        const cleanCurrent = currentHost ? currentHost.split(':')[0].replace(/^www\./, '') : '';

        const isLocalOrSameHost =
            !hasProtocol ||
            cleanHost === cleanCurrent ||
            cleanCurrent === 'localhost' ||
            cleanCurrent === '127.0.0.1' ||
            cleanHost === 'showtime.com' ||
            cleanHost === 'sffl.com';

        if (newsPathMatch && isLocalOrSameHost) {
            return {
                url: `/news/${newsPathMatch[1]}`,
                isInternal: true,
                slug: newsPathMatch[1],
            };
        }

        return {
            url: parsed.toString(),
            isInternal: false,
            domain: cleanHost || parsed.hostname,
        };
    } catch {
        return null;
    }
};

/** Extracts the 11-char video id from any YouTube URL form (watch, youtu.be,
 *  shorts, live, embed) or from a bare id. Returns null when unparseable. */
export const parseYouTubeId = (input: string): string | null => {
    const trimmed = (input || '').trim();
    if (!trimmed) return null;
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    try {
        const url = new URL(trimmed);
        const host = url.hostname.replace(/^www\.|^m\./, '');
        if (host === 'youtu.be') {
            const id = url.pathname.slice(1).split('/')[0];
            return /^[\w-]{11}$/.test(id) ? id : null;
        }
        if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            const v = url.searchParams.get('v');
            if (v && /^[\w-]{11}$/.test(v)) return v;
            const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
            if (m) return m[1];
        }
    } catch {
        // not a URL and not a bare id
    }
    return null;
};

export const youTubeEmbedUrl = (videoId: string) =>
    `https://www.youtube-nocookie.com/embed/${videoId}`;

export const youTubeThumbnailUrl = (videoId: string) =>
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
