import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getStandings, getCompetitions, getTeams,
    createStanding, deleteStanding,
    type Standing, type Competition, type Team, type CreateStandingPayload,
} from '../../services/api';

interface FormData {
    competition_id: string; team_id: string;
    won: string; drawn: string; lost: string;
    goals_for: string; goals_against: string;
    l5_1: string; l5_2: string; l5_3: string; l5_4: string; l5_5: string;
}

const emptyForm: FormData = {
    competition_id: '', team_id: '',
    won: '0', drawn: '0', lost: '0',
    goals_for: '0', goals_against: '0',
    l5_1: '', l5_2: '', l5_3: '', l5_4: '', l5_5: '',
};

const L5_OPTIONS = [
    { value: '', label: '-' },
    { value: 'W', label: 'W' },
    { value: 'D', label: 'D' },
    { value: 'L', label: 'L' },
];

export const AdminStandings = () => {
    const queryClient = useQueryClient();
    const [selectedComp, setSelectedComp] = useState('');

    const { data: compsData, isLoading: loadingComps } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100, 'active'),
    });

    // Auto-select first competition when loaded
    useEffect(() => {
        const comps = compsData?.data || [];
        if (comps.length > 0 && !selectedComp) {
            setSelectedComp(comps[0].id);
        }
    }, [compsData, selectedComp]);

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['adminTeamsList'],
        queryFn: () => getTeams(1, 100),
    });

    const { data: standingsData, isLoading: loadingStandings } = useQuery({
        queryKey: ['adminStandings', selectedComp],
        queryFn: () => getStandings(selectedComp),
        enabled: !!selectedComp,
    });

    const competitions: Competition[] = compsData?.data || [];
    const teams: Team[] = teamsData?.data || [];
    const standings: Standing[] = Array.isArray(standingsData) ? standingsData : [];
    const loading = loadingComps || loadingTeams || (!!selectedComp && loadingStandings);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);



    const openCreate = () => {
        setForm({ ...emptyForm, competition_id: selectedComp });
        setShowModal(true);
    };



    const buildL5 = (): string => {
        const parts = [form.l5_1, form.l5_2, form.l5_3, form.l5_4, form.l5_5].filter(p => p !== '');
        return parts.join('-');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateStandingPayload = {
                competition_id: form.competition_id || selectedComp,
                team_id: form.team_id,
                won: parseInt(form.won) || 0,
                drawn: parseInt(form.drawn) || 0,
                lost: parseInt(form.lost) || 0,
                goals_for: parseInt(form.goals_for) || 0,
                goals_against: parseInt(form.goals_against) || 0,
                l5: buildL5(),
            };
            await createStanding(payload);
            toast.success('Standing created successfully');
            queryClient.invalidateQueries({ queryKey: ['adminStandings', selectedComp] });
            setShowModal(false);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save standing');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteStanding(id);
            queryClient.invalidateQueries({ queryKey: ['adminStandings', selectedComp] });
            setDeleteConfirm(null);
            toast.success('Standing deleted successfully');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete standing');
        }
    };

    const set = (field: keyof FormData, v: string) => setForm(p => ({ ...p, [field]: v }));

    const l5Color = (v: string) => {
        if (v === 'W') return 'bg-green-500 text-white border-green-600';
        if (v === 'D') return 'bg-yellow-400 text-gray-900 border-yellow-500';
        if (v === 'L') return 'bg-red-500 text-white border-red-600';
        return 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Standings Management</h1>
                <div className="flex items-center gap-3">
                    <select value={selectedComp} onChange={e => setSelectedComp(e.target.value)} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50 font-semibold text-sm">
                        {competitions.map(c => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap">+ Add Entry</button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-x-auto border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-12">Pos</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Team</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">P</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">W</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">D</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">L</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">PF</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">PA</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">PD</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">PCT</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">L5</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {standings.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <td className="px-4 py-3 font-black text-sffl-navy dark:text-white">{s.position}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {s.team?.logo && (
                                                <LightboxImage 
                                                    src={s.team.logo} 
                                                    alt={s.team?.name} 
                                                    thumbnailClassName="w-6 h-6 object-contain rounded-md" 
                                                />
                                            )}
                                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{s.team?.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.played ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.won ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.drawn ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.lost ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.goals_for ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.goals_against ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm font-semibold dark:text-gray-300">{(s.goal_diff ?? 0) > 0 ? '+' : ''}{s.goal_diff ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm dark:text-gray-300">{s.pct != null ? `${s.pct}%` : '-'}</td>
                                    <td className="px-4 py-3 text-center text-xs font-mono dark:text-gray-300">
                                        <div className="flex justify-center gap-1">
                                            {s.l5 ? s.l5.split('').filter(c => c !== '-').map((res, i) => (
                                                <span key={i} title={res} className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${res === 'W' ? 'bg-green-500 text-white' : res === 'D' ? 'bg-yellow-400 text-gray-900' : res === 'L' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                                                    {res}
                                                </span>
                                            )) : '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">

                                        <button onClick={() => setDeleteConfirm(s.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 font-bold text-sm">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {standings.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No standings data for this competition</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700"><h2 className="text-2xl font-black text-sffl-navy dark:text-white">Add Standing</h2></div>
                        <div className="p-6 space-y-4">
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Team *</label>
                                <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50">
                                    <option value="" className="truncate">Select...</option>
                                    {teams.map(t => <option key={t.id} value={t.id} className="truncate">{t.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">W</label><input type="number" value={form.won} onChange={e => set('won', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">D</label><input type="number" value={form.drawn} onChange={e => set('drawn', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">L</label><input type="number" value={form.lost} onChange={e => set('lost', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">PF (Points For)</label><input type="number" value={form.goals_for} onChange={e => set('goals_for', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">PA (Points Against)</label><input type="number" value={form.goals_against} onChange={e => set('goals_against', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" min="0" /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Last 5 Games</label>
                                <div className="flex gap-2 mb-3">
                                    {(['l5_1', 'l5_2', 'l5_3', 'l5_4', 'l5_5'] as const).map((field, i) => (
                                        <select
                                            key={i}
                                            value={form[field]}
                                            onChange={e => set(field, e.target.value)}
                                            className={`w-14 h-11 min-h-[44px] z-50 border rounded-lg text-center font-black text-sm cursor-pointer transition ${l5Color(form[field])}`}
                                        >
                                            {L5_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Quick Add New Result:</span>
                                    {['W', 'D', 'L'].map(res => (
                                        <button
                                            key={res}
                                            type="button"
                                            onClick={() => {
                                                // Shift left and append new
                                                setForm(prev => ({
                                                    ...prev,
                                                    l5_1: prev.l5_2,
                                                    l5_2: prev.l5_3,
                                                    l5_3: prev.l5_4,
                                                    l5_4: prev.l5_5,
                                                    l5_5: res
                                                }));
                                            }}
                                            className={`w-8 h-8 rounded text-sm font-black transition hover:scale-105 border ${l5Color(res)}`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Oldest results will automatically shift out when you Quick Add.</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
                                <strong>Auto-computed:</strong> P (W+D+L), PD (PF−PA), PCT (W÷P × 100)
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white font-bold text-sm rounded-lg hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Standing?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 min-h-[44px] bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
