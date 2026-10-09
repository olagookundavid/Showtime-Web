// Pasting from Word, Google Docs or a web page brings the source's own text and
// background colours with it, usually black on white. Those are invisible or
// glaring in dark mode, and the author never chose them here, so they are
// dropped on paste. Colours picked in the editor's own colour tools are kept.
export const stripForeignColors = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
        el.style.removeProperty('color');
        el.style.removeProperty('background-color');
        el.style.removeProperty('background');
        if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    doc.querySelectorAll('font[color]').forEach(el => el.removeAttribute('color'));
    doc.querySelectorAll('[bgcolor]').forEach(el => el.removeAttribute('bgcolor'));
    return doc.body.innerHTML;
};
