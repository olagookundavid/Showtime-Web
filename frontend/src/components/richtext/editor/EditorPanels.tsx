import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LinkSlashIcon, NoSymbolIcon, SwatchIcon } from '@heroicons/react/24/outline';
import type { Editor } from '@tiptap/core';
import { getNews } from '../../../services/api';
import { Button, Field, Input, Spinner } from '../../ui';
import { parseNewsRefUrl, parseYouTubeId } from '../../../utils';

// The small forms that open under the toolbar: link, text colour, highlight,
// YouTube video and news reference card. Each acts on the editor and closes.

export type Panel = 'link' | 'color' | 'highlight' | 'youtube' | 'news';

interface PanelProps {
    editor: Editor;
    onClose: () => void;
}

const panelClass = 'p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-2';

/** Adds https:// to a bare domain; leaves site paths, mailto: and tel: alone. */
const normalizeHref = (raw: string) => {
    const href = raw.trim();
    if (!href) return '';
    if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) return href;
    return `https://${href}`;
};

export const LinkPanel = ({ editor, onClose }: PanelProps) => {
    const current = (editor.getAttributes('link').href as string | undefined) ?? '';
    const [href, setHref] = useState(current);

    const apply = () => {
        const url = normalizeHref(href);
        if (!url) {
            toast.error('Enter a link address');
            return;
        }
        const chain = editor.chain().focus();
        if (editor.state.selection.empty && !editor.isActive('link')) {
            // Nothing selected: insert the address itself as the link text.
            chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
        } else {
            chain.extendMarkRange('link').setLink({ href: url }).run();
        }
        onClose();
    };

    const remove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        onClose();
    };

    return (
        <div className={panelClass}>
            <Field label="Link address" htmlFor="rte-link" hint="A web address like showtimeflag.football/tickets, or a site page like /matches.">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        id="rte-link"
                        type="text"
                        value={href}
                        onChange={e => setHref(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                        placeholder="https://"
                        className="flex-1 min-w-0"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={apply}>Apply link</Button>
                        {current && (
                            <Button size="sm" variant="secondary" icon={LinkSlashIcon} onClick={remove}>Remove</Button>
                        )}
                    </div>
                </div>
            </Field>
        </div>
    );
};

const PRESET_COLORS = [
    { name: 'Showtime red', value: '#c62828' },
    { name: 'Showtime navy', value: '#001f3f' },
    { name: 'Charcoal', value: '#374151' },
    { name: 'Grey', value: '#6b7280' },
    { name: 'Green', value: '#15803d' },
    { name: 'Blue', value: '#1d4ed8' },
    { name: 'Purple', value: '#7e22ce' },
    { name: 'Orange', value: '#c2410c' },
];

const PRESET_HIGHLIGHTS = [
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Orange', value: '#fed7aa' },
    { name: 'Purple', value: '#e9d5ff' },
    { name: 'Red', value: '#fecaca' },
    { name: 'Grey', value: '#e5e7eb' },
];

export const ColorPanel = ({ editor, onClose, mode }: PanelProps & { mode: 'color' | 'highlight' }) => {
    const isText = mode === 'color';
    const current = isText
        ? (editor.getAttributes('textStyle').color as string | undefined)
        : (editor.getAttributes('highlight').color as string | undefined);
    const customRef = useRef<HTMLInputElement>(null);

    const apply = (value: string) => {
        const chain = editor.chain().focus();
        (isText ? chain.setColor(value) : chain.setHighlight({ color: value })).run();
    };
    const clear = () => {
        const chain = editor.chain().focus();
        (isText ? chain.unsetColor() : chain.unsetHighlight()).run();
        onClose();
    };

    const presets = isText ? PRESET_COLORS : PRESET_HIGHLIGHTS;

    return (
        <div className={panelClass}>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {isText ? 'Text colour' : 'Highlight colour'} for the selected text
            </p>
            <div className="flex flex-wrap items-center gap-2">
                {presets.map(c => (
                    // Selectable swatch tile: stays raw (frontend/CLAUDE.md §7).
                    <button
                        key={c.value}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { apply(c.value); onClose(); }}
                        aria-label={c.name}
                        title={c.name}
                        className={`w-11 h-11 rounded-lg border-2 transition ${current === c.value ? 'border-sffl-red' : 'border-white dark:border-gray-800 hover:border-gray-300'} shadow-sm`}
                        style={{ backgroundColor: c.value }}
                    />
                ))}
                <Button
                    size="sm"
                    variant="secondary"
                    icon={SwatchIcon}
                    onClick={() => customRef.current?.click()}
                >
                    Any colour
                </Button>
                {/* The native colour picker, opened by the button above. */}
                <input
                    ref={customRef}
                    type="color"
                    value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#c62828'}
                    onChange={e => apply(e.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                />
                <Button size="sm" variant="ghost" icon={NoSymbolIcon} onClick={clear}>
                    No colour
                </Button>
            </div>
            {isText && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Readers on dark mode see dark colours automatically lightened, so they stay readable.
                </p>
            )}
        </div>
    );
};

export const YouTubePanel = ({ editor, onClose }: PanelProps) => {
    const [url, setUrl] = useState('');
    const insert = () => {
        const videoId = parseYouTubeId(url);
        if (!videoId) {
            toast.error('That does not look like a valid YouTube link');
            return;
        }
        editor.chain().focus().insertYouTube({ videoId }).run();
        onClose();
    };
    return (
        <div className={panelClass}>
            <Field label="YouTube link" htmlFor="rte-youtube">
                <div className="flex gap-2">
                    <Input
                        id="rte-youtube"
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insert(); } }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 min-w-0"
                        autoFocus
                    />
                    <Button size="sm" className="shrink-0" onClick={insert}>Insert video</Button>
                </div>
            </Field>
        </div>
    );
};

export const NewsPanel = ({ editor, onClose }: PanelProps) => {
    const [url, setUrl] = useState('');
    const [search, setSearch] = useState('');
    const { data, isLoading } = useQuery({
        queryKey: ['richEditorNews', search],
        queryFn: () => getNews(1, 20, search || undefined),
    });
    const articles = data?.data || [];

    const insert = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed || !parseNewsRefUrl(trimmed)) {
            toast.error('Enter a valid news link');
            return;
        }
        editor.chain().focus().insertNewsRef({ url: trimmed }).run();
        onClose();
    };

    return (
        <div className={`${panelClass} space-y-3`}>
            <Field label="News link" htmlFor="rte-news-url" hint="Another site's article, or one of ours like /news/article-slug.">
                <div className="flex gap-2">
                    <Input
                        id="rte-news-url"
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insert(url); } }}
                        placeholder="https://… or /news/article-slug"
                        className="flex-1 min-w-0"
                        autoFocus
                    />
                    <Button size="sm" className="shrink-0" onClick={() => insert(url)}>Insert card</Button>
                </div>
            </Field>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label htmlFor="rte-news-filter" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Or pick one of our articles:
                    </label>
                    <Input
                        id="rte-news-filter"
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter articles"
                        className="w-full sm:w-48"
                    />
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    {isLoading && <Spinner label="Loading articles" size="sm" className="py-3" />}
                    {articles.map(n => (
                        // Picker row: stays raw (frontend/CLAUDE.md §7).
                        <button
                            key={n.id}
                            type="button"
                            onClick={() => insert(`/news/${n.slug}`)}
                            className="w-full min-h-11 flex items-center justify-between gap-2 p-2 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                            <span className="font-semibold truncate min-w-0">{n.title}</span>
                            <span className="text-xs text-gray-400 truncate font-mono shrink-0 max-w-[40%]">/news/{n.slug}</span>
                        </button>
                    ))}
                    {!isLoading && articles.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No articles found</p>
                    )}
                </div>
            </div>
        </div>
    );
};
