// Helpers for rich-text fields (article bodies, descriptions, bios).
//
// New values are editor HTML. Values saved before the rich-text editor are
// plain text, and stay valid: they render as paragraphs and convert to HTML the
// first time someone edits them. looksLikeHtml tells the two apart, and must
// match LooksLikeHTML in backend/internal/richtext/richtext.go.

export const looksLikeHtml = (value: string | null | undefined): boolean =>
    (value || '').trimStart().startsWith('<');

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text to editor HTML: blank lines split paragraphs, single newlines
 *  become line breaks (how plain descriptions always displayed). */
export const plainTextToHtml = (text: string): string =>
    text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');

/** The value to load into the editor, whichever format it was stored in. */
export const toEditorHtml = (value: string | null | undefined): string =>
    looksLikeHtml(value) ? (value as string) : plainTextToHtml(value || '');

const BLOCK_END_RE = /<br\s*\/?>|<\/(p|h[1-6]|li|td|th|figcaption|blockquote|pre|div|tr)>/gi;

/** Readable text of a value, for cards, previews and word counts. */
export const htmlToPlainText = (value: string | null | undefined): string => {
    if (!value) return '';
    if (!looksLikeHtml(value)) return value.trim();
    // DOMParser builds an inert document: no scripts run, no images load.
    const doc = new DOMParser().parseFromString(value.replace(BLOCK_END_RE, '$& '), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const EMBED_RE = /<(img|div data-youtube|div data-news-ref)\b/;

/** True when a value has no text and no embedded media, e.g. an editor that
 *  was cleared down to "<p></p>". */
export const isRichTextEmpty = (value: string | null | undefined): boolean =>
    htmlToPlainText(value) === '' && !EMBED_RE.test(value || '');

export const readingTime = (value: string | null | undefined): string => {
    const text = htmlToPlainText(value);
    const words = text ? text.split(/\s+/).length : 0;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
};
