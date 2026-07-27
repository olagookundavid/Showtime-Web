import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getTeams, getPlayers, getNews } from '../../services/api';
import { useImageUpload } from '../../hooks/useImageUpload';
import { parseYouTubeId, parseNewsRefUrl } from '../../utils/newsContent';

// Article body editor: a plain textarea plus a toolbar that inserts news tags
// at the cursor. Media tags ([image:...], [youtube:...], [news:...]) are inserted as their
// own paragraph; team/player mentions are inserted inline.

const MAX_INLINE_IMAGE_MB = 10;

type Panel = 'youtube' | 'team' | 'player' | 'news' | null;

interface NewsContentEditorProps {
    value: string;
    onChange: (value: string) => void;
    rows?: number;
}

export const NewsContentEditor = ({ value, onChange, rows = 10 }: NewsContentEditorProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadImage, deleteImage, isUploading, progress } = useImageUpload();

    const [panel, setPanel] = useState<Panel>(null);
    const [youtubeInput, setYoutubeInput] = useState('');
    const [teamSearch, setTeamSearch] = useState('');
    const [playerSearch, setPlayerSearch] = useState('');
    const [newsSearch, setNewsSearch] = useState('');
    const [newsUrlInput, setNewsUrlInput] = useState('');

    // Uploaded image waiting for its caption before being inserted into the body.
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [captionInput, setCaptionInput] = useState('');

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['newsEditorTeams'],
        queryFn: () => getTeams(1, 100),
        enabled: panel === 'team',
    });
    const { data: playersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['newsEditorPlayers', playerSearch],
        queryFn: () => getPlayers(undefined, 1, 20, playerSearch || undefined),
        enabled: panel === 'player',
    });
    const { data: newsListData, isLoading: loadingNews } = useQuery({
        queryKey: ['newsEditorNews', newsSearch],
        queryFn: () => getNews(1, 20, newsSearch || undefined),
        enabled: panel === 'news',
    });

    const teams = (teamsData?.data || []).filter(t =>
        !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase())
    );
    const players = playersData?.data || [];
    const newsList = newsListData?.data || [];

    // Inserts at the cursor (or appends). Block tags get blank lines around
    // them so they render as their own paragraph.
    const insertAtCursor = (snippet: string, block: boolean) => {
        const el = textareaRef.current;
        const start = el ? el.selectionStart : value.length;
        const end = el ? el.selectionEnd : value.length;
        const before = value.slice(0, start);
        const after = value.slice(end);

        let text = snippet;
        if (block) {
            const pre = before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
            const post = after.startsWith('\n\n') || after.length === 0 ? '\n' : after.startsWith('\n') ? '\n' : '\n\n';
            text = `${pre}${snippet}${post}`;
        }

        const next = before + text + after;
        onChange(next);
        // Restore focus and put the cursor right after the inserted snippet.
        requestAnimationFrame(() => {
            if (el) {
                el.focus();
                const pos = before.length + text.length;
                el.setSelectionRange(pos, pos);
            }
        });
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;
        if (file.size > MAX_INLINE_IMAGE_MB * 1024 * 1024) {
            toast.error(`File size exceeds ${MAX_INLINE_IMAGE_MB}MB limit`);
            return;
        }
        const url = await uploadImage(file, 'news', { maxSizeMB: 1.5, maxWidthOrHeight: 1920 });
        if (url) {
            setCaptionInput('');
            setPendingImage(url);
        } else {
            toast.error('Failed to upload image');
        }
    };

    const insertPendingImage = () => {
        if (!pendingImage) return;
        // [ ] and | are tag syntax — keep them out of captions.
        const caption = captionInput.replace(/[\[\]|]/g, '').trim();
        insertAtCursor(`[image:${pendingImage}${caption ? `|${caption}` : ''}]`, true);
        setPendingImage(null);
        setCaptionInput('');
    };

    const cancelPendingImage = () => {
        if (pendingImage) deleteImage(pendingImage);
        setPendingImage(null);
        setCaptionInput('');
    };

    const handleYoutubeInsert = () => {
        if (!parseYouTubeId(youtubeInput)) {
            toast.error('That does not look like a valid YouTube link');
            return;
        }
        insertAtCursor(`[youtube:${youtubeInput.trim()}]`, true);
        setYoutubeInput('');
        setPanel(null);
    };

    const handleNewsUrlInsert = () => {
        const trimmed = newsUrlInput.trim();
        if (!trimmed) {
            toast.error('Enter a valid news link or URL');
            return;
        }
        const ref = parseNewsRefUrl(trimmed);
        if (!ref) {
            toast.error('Invalid URL format');
            return;
        }
        insertAtCursor(`[news:${trimmed}]`, true);
        setNewsUrlInput('');
        setPanel(null);
    };

    const toolbarBtn = 'px-2.5 py-1.5 text-xs font-bold rounded-md border transition disabled:opacity-50';
    const inactive = 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
    const active = 'border-sffl-red text-sffl-red bg-sffl-red/10';

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleImagePick} accept="image/*" className="hidden" />
                <button type="button" disabled={isUploading} onClick={() => { setPanel(null); fileInputRef.current?.click(); }} className={`${toolbarBtn} ${inactive}`}>
                    {isUploading ? `Uploading… ${progress}%` : '📷 Insert Image'}
                </button>
                <button type="button" onClick={() => setPanel(panel === 'youtube' ? null : 'youtube')} className={`${toolbarBtn} ${panel === 'youtube' ? active : inactive}`}>
                    ▶ Insert YouTube
                </button>
                <button type="button" onClick={() => setPanel(panel === 'news' ? null : 'news')} className={`${toolbarBtn} ${panel === 'news' ? active : inactive}`}>
                    📰 Reference News Link
                </button>
                <button type="button" onClick={() => setPanel(panel === 'team' ? null : 'team')} className={`${toolbarBtn} ${panel === 'team' ? active : inactive}`}>
                    🏈 Tag Team
                </button>
                <button type="button" onClick={() => setPanel(panel === 'player' ? null : 'player')} className={`${toolbarBtn} ${panel === 'player' ? active : inactive}`}>
                    👤 Tag Player
                </button>
            </div>

            {/* Caption panel for a just-uploaded image */}
            {pendingImage && (
                <div className="flex gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <img src={pendingImage} alt="Uploaded preview" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <input
                            type="text"
                            value={captionInput}
                            onChange={e => setCaptionInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertPendingImage(); } }}
                            placeholder="Caption (optional) — e.g. Jones celebrates the TD"
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-sm"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={insertPendingImage} className="px-3 py-1.5 bg-sffl-red text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">
                                Insert Image
                            </button>
                            <button type="button" onClick={cancelPendingImage} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* YouTube panel */}
            {panel === 'youtube' && (
                <div className="flex gap-2 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <input
                        type="text"
                        value={youtubeInput}
                        onChange={e => setYoutubeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleYoutubeInsert(); } }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-sm"
                        autoFocus
                    />
                    <button type="button" onClick={handleYoutubeInsert} className="px-3 py-1.5 bg-sffl-red text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">
                        Insert
                    </button>
                </div>
            )}

            {/* News Reference panel */}
            {panel === 'news' && (
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            External or Internal News Link URL:
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newsUrlInput}
                                onChange={e => setNewsUrlInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNewsUrlInsert(); } }}
                                placeholder="e.g. https://go.com/news/123 or /news/article-slug"
                                className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-sm"
                                autoFocus
                            />
                            <button type="button" onClick={handleNewsUrlInsert} className="px-3 py-1.5 bg-sffl-red text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">
                                Insert URL
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                Or select an internal article:
                            </label>
                            <input
                                type="text"
                                value={newsSearch}
                                onChange={e => setNewsSearch(e.target.value)}
                                placeholder="Filter internal news..."
                                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-0.5 text-xs w-48"
                            />
                        </div>
                        <div className="max-h-36 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                            {loadingNews && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 p-2">Loading articles…</p>
                            )}
                            {newsList.map(n => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => {
                                        insertAtCursor(`[news:/news/${n.slug}]`, true);
                                        setPanel(null);
                                        setNewsSearch('');
                                    }}
                                    className="w-full flex items-center justify-between p-2 text-left text-xs text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                >
                                    <span className="font-semibold truncate max-w-[80%]">{n.title}</span>
                                    <span className="text-[10px] text-gray-400 truncate font-mono">/news/{n.slug}</span>
                                </button>
                            ))}
                            {!loadingNews && newsList.length === 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 p-2">No internal articles found</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Team / Player picker panels */}
            {(panel === 'team' || panel === 'player') && (
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-2">
                    <input
                        type="text"
                        value={panel === 'team' ? teamSearch : playerSearch}
                        onChange={e => (panel === 'team' ? setTeamSearch(e.target.value) : setPlayerSearch(e.target.value))}
                        placeholder={panel === 'team' ? 'Search teams…' : 'Search players by name or position…'}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-sm"
                        autoFocus
                    />
                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600">
                        {(panel === 'team' ? loadingTeams : loadingPlayers) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 py-2">Loading…</p>
                        )}
                        {panel === 'team' && teams.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => { insertAtCursor(`[team:${t.id}|${t.name}]`, false); setPanel(null); setTeamSearch(''); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-600 rounded transition"
                            >
                                {t.logo && <img src={t.logo} alt="" className="w-5 h-5 rounded-full object-cover" />}
                                <span className="font-semibold">{t.name}</span>
                                {t.short_name && <span className="text-xs text-gray-500 dark:text-gray-400">({t.short_name})</span>}
                            </button>
                        ))}
                        {panel === 'team' && !loadingTeams && teams.length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 py-2">No teams found</p>
                        )}
                        {panel === 'player' && players.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { insertAtCursor(`[player:${p.id}|${p.name}]`, false); setPanel(null); setPlayerSearch(''); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-600 rounded transition"
                            >
                                <span className="font-semibold">{p.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    #{p.jersey_number} {p.position}{p.team?.name ? ` · ${p.team.name}` : ''}
                                </span>
                            </button>
                        ))}
                        {panel === 'player' && !loadingPlayers && players.length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 py-2">No players found</p>
                        )}
                    </div>
                </div>
            )}

            {/* Body textarea */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                rows={rows}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 font-mono text-sm"
                placeholder={'Write your article…\n\nSeparate paragraphs with a blank line. Use the buttons above to insert photos, videos, news references, and team/player tags at the cursor.'}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Tags like [image:…|caption], [youtube:…], [news:…], [team:…|Name] and [player:…|Name] render as photos, embedded videos, interactive news cards, and highlighted links on the public page.
            </p>
        </div>
    );
};

