import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAdminSeasonGraphics, upsertSeasonGraphic,
    getAdminSeasonMVPs, createSeasonMVP, updateSeasonMVP, deleteSeasonMVP,
    getPlayers,
    type SeasonMVP, type Player,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui';

type Cat = 'offense' | 'defense';
type GraphicState = { image_url: string; mobile_image_url: string };

export const AdminSeason = () => {
    const queryClient = useQueryClient();

    const { data: graphics = [], isLoading: gLoading } = useQuery({
        queryKey: ['adminSeasonGraphics'],
        queryFn: getAdminSeasonGraphics,
    });
    const { data: mvps = [], isLoading: mLoading } = useQuery({
        queryKey: ['adminSeasonMVPs'],
        queryFn: getAdminSeasonMVPs,
    });

    // Local editable copy of the two graphics, seeded from the server.
    const [state, setState] = useState<Record<Cat, GraphicState>>({
        offense: { image_url: '', mobile_image_url: '' },
        defense: { image_url: '', mobile_image_url: '' },
    });

    useEffect(() => {
        const next: Record<Cat, GraphicState> = {
            offense: { image_url: '', mobile_image_url: '' },
            defense: { image_url: '', mobile_image_url: '' },
        };
        for (const g of graphics) {
            next[g.category] = { image_url: g.image_url, mobile_image_url: g.mobile_image_url || '' };
        }
        setState(next);
    }, [graphics]);

    const refreshGraphics = () => queryClient.invalidateQueries({ queryKey: ['adminSeasonGraphics'] });
    const refreshMVPs = () => queryClient.invalidateQueries({ queryKey: ['adminSeasonMVPs'] });

    // Persist a graphic whenever its desktop or mobile image changes. Desktop
    // image is required by the API, so we only save once one is present.
    const saveGraphic = async (category: Cat, field: keyof GraphicState, url: string) => {
        const merged = { ...state[category], [field]: url };
        setState(prev => ({ ...prev, [category]: merged }));
        if (!merged.image_url) return; // wait for a desktop image before saving
        await upsertSeasonGraphic({
            category,
            image_url: merged.image_url,
            mobile_image_url: merged.mobile_image_url || undefined,
        });
        refreshGraphics();
    };

    // ── MVP add form ──
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Player | null>(null);
    const [label, setLabel] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const { data: playerResults, isLoading: searching } = useQuery({
        queryKey: ['seasonPlayerSearch', search],
        queryFn: () => getPlayers(undefined, 1, 15, search),
        enabled: search.trim().length >= 2,
    });
    const foundPlayers = playerResults?.data || [];

    // Close the results dropdown when clicking outside the search box.
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const handleAddMVP = async () => {
        if (!selected) { setError('Pick a player'); return; }
        if (!label.trim()) { setError('Enter a label (e.g. Offensive MVP)'); return; }
        setAdding(true);
        setError('');
        try {
            await createSeasonMVP({ player_id: selected.id, label: label.trim(), display_order: mvps.length });
            refreshMVPs();
            setSelected(null);
            setSearch('');
            setLabel('');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add MVP');
        }
        setAdding(false);
    };

    const handleMove = async (mvp: SeasonMVP, direction: 'up' | 'down') => {
        const idx = mvps.findIndex(m => m.id === mvp.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= mvps.length) return;
        const other = mvps[swapIdx];
        await Promise.all([
            updateSeasonMVP(mvp.id, { display_order: other.display_order }),
            updateSeasonMVP(other.id, { display_order: mvp.display_order }),
        ]);
        refreshMVPs();
    };

    const handleDeleteMVP = async (id: string) => {
        await deleteSeasonMVP(id);
        refreshMVPs();
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Team of the Season</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Two graphics (Offense &amp; Defense) plus a curated list of MVPs shown on the homepage.
                </p>
            </div>

            {/* Graphics */}
            <section className="space-y-4">
                <h2 className="text-xl font-black text-sffl-navy dark:text-white">Graphics</h2>
                {gLoading ? <Loader /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(['offense', 'defense'] as Cat[]).map(cat => (
                            <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                                <h3 className="font-black uppercase tracking-wider text-sffl-navy dark:text-white">{cat}</h3>
                                <ImageUploadField
                                    label="Desktop Graphic"
                                    value={state[cat].image_url}
                                    onChange={(url) => saveGraphic(cat, 'image_url', url)}
                                    folder="season"
                                    maxSizeMB={15}
                                    compression={{ maxSizeMB: 4, maxWidthOrHeight: 2560 }}
                                    helperText="The full Team-of-the-Season graphic (shown as-is, not cropped)."
                                    isCommitted
                                />
                                <ImageUploadField
                                    label="Mobile Graphic (optional)"
                                    value={state[cat].mobile_image_url}
                                    onChange={(url) => saveGraphic(cat, 'mobile_image_url', url)}
                                    folder="season"
                                    maxSizeMB={15}
                                    compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                                    helperText="Optional portrait/square version for phones. Falls back to desktop."
                                    isCommitted
                                />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* MVPs */}
            <section className="space-y-4">
                <h2 className="text-xl font-black text-sffl-navy dark:text-white">MVPs</h2>

                {/* Add form */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div ref={searchRef} className="md:col-span-2 relative">
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Player</label>
                            <input
                                value={search}
                                onChange={(e) => { setSelected(null); setSearch(e.target.value); setShowDropdown(true); }}
                                onFocus={() => { if (search.trim().length >= 2) setShowDropdown(true); }}
                                placeholder="Search player by name…"
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red"
                            />
                            {selected && (
                                <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-bold">✓ Selected: {selected.name}</p>
                            )}
                            {showDropdown && search.trim().length >= 2 && (
                                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                                    {searching ? (
                                        <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
                                    ) : foundPlayers.length === 0 ? (
                                        <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">No player found for "{search}"</p>
                                    ) : (
                                        foundPlayers.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => { setSelected(p); setSearch(p.name); setShowDropdown(false); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
                                            >
                                                {p.image
                                                    ? <img src={p.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                                                    : <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-black">#{p.jersey_number}</span>}
                                                <span className="font-bold text-sffl-navy dark:text-white">{p.name}</span>
                                                <span className="text-gray-400 text-xs">{p.position}{p.team?.name ? ` · ${p.team.name}` : ''}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Label</label>
                            <input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="e.g. Offensive MVP"
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red"
                            />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <button
                        onClick={handleAddMVP}
                        disabled={adding || !selected || !label.trim()}
                        className="px-4 py-2 bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
                    >
                        {adding ? 'Adding…' : 'Add MVP'}
                    </button>
                </div>

                {/* List */}
                {mLoading ? <Loader /> : mvps.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No MVPs yet.</p>
                ) : (
                    <div className="space-y-2">
                        {mvps.map((mvp, idx) => (
                            <div key={mvp.id} className={`flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border p-3 ${mvp.is_active ? 'border-gray-100 dark:border-gray-700' : 'border-yellow-300 dark:border-yellow-700'}`}>
                                {mvp.player_image
                                    ? <img src={mvp.player_image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    : <span className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-black">#{mvp.player_jersey_number}</span>}
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sffl-navy dark:text-white truncate">{mvp.player_name}</p>
                                    <p className="text-xs text-sffl-red font-bold uppercase tracking-wide">★ {mvp.label}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleMove(mvp, 'up')} disabled={idx === 0} className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-bold disabled:opacity-30" title="Move up">↑</button>
                                    <button onClick={() => handleMove(mvp, 'down')} disabled={idx === mvps.length - 1} className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-bold disabled:opacity-30" title="Move down">↓</button>
                                    <button onClick={() => updateSeasonMVP(mvp.id, { is_active: !mvp.is_active }).then(refreshMVPs)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700">{mvp.is_active ? 'Hide' : 'Show'}</button>
                                    <button onClick={() => handleDeleteMVP(mvp.id)} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};
