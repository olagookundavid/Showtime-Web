// News article body tag grammar. Admins author plain text in a textarea and
// the toolbar inserts these tags; the public page parses them back out:
//
//   [image:URL]                — full-width photo between paragraphs
//   [image:URL|Caption text]   — photo with a caption
//   [youtube:URL or video id]  — embedded YouTube player
//   [team:UUID|Team Name]      — inline mention linking to /teams/:id
//   [player:UUID|Player Name]  — inline mention linking to /players/:id
//
// Anything malformed renders as the literal text it was typed as, so a broken
// tag can never take down an article.

export type NewsSegment =
    | { type: 'text'; text: string }
    | { type: 'image'; url: string; caption: string }
    | { type: 'youtube'; videoId: string };

export type InlinePart =
    | { type: 'text'; text: string }
    | { type: 'mention'; kind: 'team' | 'player'; id: string; name: string };

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

const MEDIA_TAG_RE = /\[(image|youtube):([^\]]+)\]/g;
const MENTION_TAG_RE = /\[(team|player):([^|\]]+)\|([^\]]+)\]/g;

/** Splits article content into text runs and block media (images / videos).
 *  Media tags become blocks wherever they appear, so an admin who pastes a tag
 *  mid-paragraph still gets valid output. */
export const parseNewsContent = (content: string): NewsSegment[] => {
    const segments: NewsSegment[] = [];
    let last = 0;
    for (const match of (content || '').matchAll(MEDIA_TAG_RE)) {
        const [full, kind, body] = match;
        const index = match.index ?? 0;
        const before = content.slice(last, index);
        if (before.trim()) segments.push({ type: 'text', text: before });

        if (kind === 'image') {
            const pipe = body.indexOf('|');
            const url = (pipe === -1 ? body : body.slice(0, pipe)).trim();
            const caption = pipe === -1 ? '' : body.slice(pipe + 1).trim();
            if (url) segments.push({ type: 'image', url, caption });
        } else {
            const videoId = parseYouTubeId(body);
            if (videoId) segments.push({ type: 'youtube', videoId });
            else segments.push({ type: 'text', text: full });
        }
        last = index + full.length;
    }
    const rest = (content || '').slice(last);
    if (rest.trim()) segments.push({ type: 'text', text: rest });
    return segments;
};

/** Splits a text run into plain text and team/player mentions. */
export const parseInlineMentions = (text: string): InlinePart[] => {
    const parts: InlinePart[] = [];
    let last = 0;
    for (const match of text.matchAll(MENTION_TAG_RE)) {
        const [full, kind, id, name] = match;
        const index = match.index ?? 0;
        if (index > last) parts.push({ type: 'text', text: text.slice(last, index) });
        parts.push({ type: 'mention', kind: kind as 'team' | 'player', id: id.trim(), name: name.trim() });
        last = index + full.length;
    }
    if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
    return parts;
};
