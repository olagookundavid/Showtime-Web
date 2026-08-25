import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader } from '../../components/ui/Loader';
import {
    getAdminCompetitions,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    getCompetitions,
    getTeams,
    getTeamsByCompetition,
    type Team,
} from '../../services/api';
import { ImageUploadField, LightboxImage } from '../../components/ui';


interface Competition {
    id: string;
    name: string;
    logo: string;
    status?: string;
    format?: string;
    playoff_competition_id?: string | null;
    tie_breaker_rule?: string;
    team_ids?: string[];
}

const AdminCompetitions = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const limit = 12;

    const {
        data,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminCompetitionsData', { page, limit, search }],
        queryFn: () => getAdminCompetitions(page, limit, search),
    });

    const competitions: Competition[] = data?.data || [];
    const totalPages = data?.total_pages || 1;
    const error = queryError ? (queryError as any).response?.data?.message || (queryError as any).response?.data?.error || 'Failed to fetch competitions.' : '';

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Competition | null>(null);
    const [form, setForm] = useState<{
        name: string;
        logo: string;
        status: string;
        format: string;
        playoff_competition_id: string;
        tie_breaker_rule: string;
        team_ids: string[];
    }>({
        name: '',
        logo: '',
        status: 'active',
        format: 'LEAGUE',
        playoff_competition_id: '',
        tie_breaker_rule: 'PCT_PD_PF_PA_NAME',
        team_ids: [],
    });
    const [saving, setSaving] = useState(false);
    const [teamFilter, setTeamFilter] = useState('');

    const { data: allCompsData } = useQuery({
        queryKey: ['allCompetitionsLinkable'],
        queryFn: () => getCompetitions(1, 100),
    });
    const knockoutComps = (allCompsData?.data || []).filter(c => c.format === 'KNOCKOUT');

    const { data: allTeamsData } = useQuery({
        queryKey: ['adminTeamsAll'],
        queryFn: () => getTeams(1, 100),
    });
    const allTeams: Team[] = (
        Array.isArray(allTeamsData?.data)
            ? allTeamsData.data
            : Array.isArray(allTeamsData)
                ? allTeamsData
                : []
    ).filter(t => t.status !== 'inactive');

    const filteredTeams = allTeams.filter(t =>
        t.name.toLowerCase().includes(teamFilter.toLowerCase()) ||
        t.short_name.toLowerCase().includes(teamFilter.toLowerCase())
    );

    const openCreate = () => {
        setEditing(null);
        setTeamFilter('');
        setForm({
            name: '',
            logo: '',
            status: 'active',
            format: 'LEAGUE',
            playoff_competition_id: '',
            tie_breaker_rule: 'PCT_PD_PF_PA_NAME',
            team_ids: [],
        });
        setShowModal(true);
    };

    const openEdit = async (c: Competition) => {
        setEditing(c);
        setTeamFilter('');
        setForm({
            name: c.name,
            logo: c.logo,
            status: c.status || 'active',
            format: c.format || 'LEAGUE',
            playoff_competition_id: c.playoff_competition_id || '',
            tie_breaker_rule: c.tie_breaker_rule || 'PCT_PD_PF_PA_NAME',
            team_ids: [],
        });
        setShowModal(true);

        try {
            const teamsRes = await getTeamsByCompetition(c.id);
            const teamsList: Team[] = Array.isArray(teamsRes?.data)
                ? teamsRes.data
                : Array.isArray(teamsRes)
                    ? teamsRes
                    : [];
            setForm(f => ({ ...f, team_ids: teamsList.map(t => t.id) }));
        } catch (err) {
            console.error('Failed to load enrolled teams for competition', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                playoff_competition_id: form.format === 'LEAGUE' ? (form.playoff_competition_id || null) : null
            };
            if (editing) {
                await updateCompetition(editing.id, payload);
                queryClient.invalidateQueries({ queryKey: ['adminCompetitionsData'] });
                queryClient.invalidateQueries({ queryKey: ['competitionTeams'] });
                queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
                setShowModal(false);
            } else {
                await createCompetition(payload);
                queryClient.invalidateQueries({ queryKey: ['adminCompetitionsData'] });
                queryClient.invalidateQueries({ queryKey: ['competitionTeams'] });
                queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
                setShowModal(false);
            }
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save competition.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this competition? This may affect related matches and standings.')) return;
        try {
            await deleteCompetition(id);
            queryClient.invalidateQueries({ queryKey: ['adminCompetitionsData'] });
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to delete competition.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Competitions</h1>
                <button onClick={openCreate} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">+ Add Competition</button>
            </div>

            {/* Search bar */}
            <div className="flex gap-2 w-full md:w-auto mb-2">
                <div className="relative w-full md:w-96">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                setSearch(searchInput);
                                setPage(1);
                            }
                        }}
                        placeholder="Search competitions by name..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-8 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red transition-all"
                    />
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchInput && (
                        <button
                            onClick={() => {
                                setSearchInput('');
                                setSearch('');
                                setPage(1);
                            }}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                <button
                    onClick={() => {
                        setSearch(searchInput);
                        setPage(1);
                    }}
                    className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                >
                    Search
                </button>
                {search && (
                    <button
                        onClick={() => {
                            setSearch('');
                            setSearchInput('');
                            setPage(1);
                        }}
                        title="Clear Filters"
                        className="p-2 min-h-[44px] min-w-[44px] bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v2H4V4zm2 4h12v12H6V8z" /></svg>
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <Loader />
                ) : competitions.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        {search ? `No competitions matching "${search}".` : 'No competitions found.'}
                    </div>
                ) : (
                    competitions.map(comp => (
                        <div key={comp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    {comp.logo ? (
                                        <LightboxImage 
                                            src={comp.logo} 
                                            alt={comp.name} 
                                            thumbnailClassName="w-14 h-14 rounded-lg object-contain bg-gray-50 dark:bg-gray-700/50 p-1 shadow-sm border border-gray-100 dark:border-gray-700" 
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-2xl font-black text-sffl-navy dark:text-white">
                                            🏆
                                        </div>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1">{comp.name}</h3>
                                    {comp.format === 'KNOCKOUT' && (
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            Knockout
                                        </span>
                                    )}
                                    {comp.status && (
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                            comp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            comp.status === 'inactive' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                                            comp.status === 'completed' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                            {comp.status === 'completed' && <span>🏆</span>}
                                            {comp.status}
                                        </span>
                                    )}
                                </div>
                                {comp.playoff_competition_id && (
                                    <div className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700/50 w-fit">
                                        <span>🔗 Playoff:</span>
                                        <span className="font-semibold text-sffl-navy dark:text-gray-200">
                                            {(allCompsData?.data || []).find(c => c.id === comp.playoff_competition_id)?.name || 'Linked Playoff'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <Link to={`/admin/competitions/${comp.id}/teams`}
                                        className="flex-1 text-center text-xs font-bold bg-green-50 text-green-700 hover:text-green-900 dark:bg-green-900/30 dark:text-green-400 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center">
                                        Teams
                                    </Link>
                                    <button onClick={() => openEdit(comp)}
                                        className="flex-1 text-xs font-bold bg-blue-50 text-blue-600 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(comp.id)}
                                        className="flex-1 text-xs font-bold bg-red-50 text-red-600 hover:text-red-800 dark:bg-red-900/30 dark:text-red-400 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-300 hover:scale-[1.02] active:scale-95">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-2 pt-4">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">
                    ← Prev
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">
                    Next →
                </button>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                {editing ? 'Edit Competition' : 'New Competition'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="e.g. SFFL Season 3" />
                            </div>
                            <div>
                                <ImageUploadField
                                    label="Competition Logo"
                                    value={form.logo}
                                    onChange={(url) => setForm(f => ({ ...f, logo: url }))}
                                    folder="competitions"
                                    helperText="Upload a competition logo.  "
                                    isCommitted={saving}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Format *</label>
                                <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red">
                                    <option value="LEAGUE">League (standings table)</option>
                                    <option value="KNOCKOUT">Knockout (playoff bracket)</option>
                                </select>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                    Knockout competitions show a bracket instead of standings. Winners advance automatically.
                                </p>
                            </div>

                            {form.format === 'LEAGUE' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Standings Tie-Breaker Rule *</label>
                                        <select
                                            value={form.tie_breaker_rule}
                                            onChange={e => setForm(f => ({ ...f, tie_breaker_rule: e.target.value }))}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red text-xs sm:text-sm font-medium"
                                        >
                                            <option value="PCT_PD_PF_PA_NAME">Rule 1: Win % → Point Diff → Points For → Points Against → Name (A-Z)</option>
                                            <option value="H2H_PCT_PD_PF_PA_NAME">Rule 2: Head-to-Head → Win % → Point Diff → Points For → Points Against → Name (A-Z)</option>
                                        </select>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            Determines how teams are ranked and broken when tied on points/percentage in standings.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Playoff Stage</label>
                                        <select value={form.playoff_competition_id} onChange={e => setForm(f => ({ ...f, playoff_competition_id: e.target.value }))}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red text-xs sm:text-sm">
                                            <option value="">-- No Playoff Stage --</option>
                                            {knockoutComps.map(kc => (
                                                <option key={kc.id} value={kc.id}>
                                                    {kc.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            Link a knockout stage (playoffs/bowl) to this regular season competition.
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ── Enrolled Teams Multi-Select Section ── */}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                        Enrolled Teams <span className="text-xs text-sffl-red font-semibold">({form.team_ids.length} selected)</span>
                                    </label>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, team_ids: allTeams.map(t => t.id) }))}
                                            className="font-bold text-sffl-red hover:underline"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, team_ids: [] }))}
                                            className="font-bold text-gray-500 hover:underline dark:text-gray-400"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search teams by name..."
                                    value={teamFilter}
                                    onChange={e => setTeamFilter(e.target.value)}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red"
                                />
                                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 divide-y divide-gray-100 dark:divide-gray-700/50 space-y-1 bg-gray-50/50 dark:bg-gray-900/30">
                                    {filteredTeams.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic p-2 text-center">No teams match your search.</p>
                                    ) : (
                                        filteredTeams.map(team => {
                                            const isSelected = form.team_ids.includes(team.id);
                                            return (
                                                <label
                                                    key={team.id}
                                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-red-50/80 dark:bg-red-950/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setForm(f => ({
                                                                    ...f,
                                                                    team_ids: checked
                                                                        ? [...f.team_ids, team.id]
                                                                        : f.team_ids.filter(id => id !== team.id)
                                                                }));
                                                            }}
                                                            className="w-4 h-4 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                                                        />
                                                        {team.logo ? (
                                                            <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                                                        ) : (
                                                            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                                {team.short_name?.slice(0, 2)}
                                                            </div>
                                                        )}
                                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                            {team.name} <span className="text-gray-400 font-normal">({team.short_name})</span>
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {editing && (
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <Link
                                        to={`/admin/competitions/${editing.id}/teams`}
                                        onClick={() => setShowModal(false)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold text-xs rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50 transition-all min-h-[44px]"
                                    >
                                        🏈 Manage Enrolled Teams Standalone Page →
                                    </Link>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCompetitions;
