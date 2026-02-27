import { useEffect, useState } from 'react';
import {
    getStandings, getCompetitions, getTeams,
    createStanding, updateStanding, deleteStanding,
    type Standing, type Competition, type Team, type CreateStandingPayload,
} from '../../services/api';

interface FormData {
    competition_id: string; team_id: string; position: string;
    won: string; drawn: string; lost: string;
    goals_for: string; goals_against: string;
    l5_1: string; l5_2: string; l5_3: string; l5_4: string; l5_5: string;
}

const emptyForm: FormData = {
    competition_id: '', team_id: '', position: '1',
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
    const [standings, setStandings] = useState<Standing[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedComp, setSelectedComp] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const [comps, teamData] = await Promise.all([getCompetitions(), getTeams()]);
                setCompetitions(comps);
                setTeams(teamData);
                if (comps.length > 0) setSelectedComp(comps[0].id);
            } catch (err) { console.error(err); }
        };
        init();
    }, []);

    useEffect(() => {
        if (!selectedComp) { setLoading(false); return; }
        const fetchStandings = async () => {
            setLoading(true);
            try {
                const data = await getStandings(selectedComp);
                setStandings(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error(err);
                setStandings([]);
            }
            setLoading(false);
        };
        fetchStandings();
    }, [selectedComp]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, competition_id: selectedComp });
        setShowModal(true);
    };

    const parseL5 = (l5: string): [string, string, string, string, string] => {
        const parts = l5 ? l5.split('-') : [];
        return [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || '', parts[4] || ''];
    };

    const openEdit = (s: Standing) => {
        const [l5_1, l5_2, l5_3, l5_4, l5_5] = parseL5(s.l5);
        setEditingId(s.id);
        setForm({
            competition_id: selectedComp,
            team_id: s.team?.id || '',
            position: s.position?.toString() || '1',
            won: s.won?.toString() || '0',
            drawn: s.drawn?.toString() || '0',
            lost: s.lost?.toString() || '0',
            goals_for: s.goals_for?.toString() || '0',
            goals_against: s.goals_against?.toString() || '0',
            l5_1, l5_2, l5_3, l5_4, l5_5,
        });
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
                position: parseInt(form.position) || 1,
                won: parseInt(form.won) || 0,
                drawn: parseInt(form.drawn) || 0,
                lost: parseInt(form.lost) || 0,
                goals_for: parseInt(form.goals_for) || 0,
                goals_against: parseInt(form.goals_against) || 0,
                l5: buildL5(),
            };
            if (editingId) await updateStanding(editingId, payload);
            else await createStanding(payload);
            setShowModal(false);
            const data = await getStandings(selectedComp);
            setStandings(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); alert('Failed to save standing'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteStanding(id);
            setDeleteConfirm(null);
            const data = await getStandings(selectedComp);
            setStandings(Array.isArray(data) ? data : []);
        } catch (err) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, v: string) => setForm(p => ({ ...p, [field]: v }));

    const l5Color = (v: string) => {
        if (v === 'W') return 'bg-green-500 text-white';
        if (v === 'D') return 'bg-yellow-400 text-gray-900';
        if (v === 'L') return 'bg-red-500 text-white';
        return '';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy">Standings Management</h1>
                <div className="flex items-center gap-3">
                    <select value={selectedComp} onChange={e => setSelectedComp(e.target.value)} className="border rounded-lg px-3 py-2 font-semibold text-sm">
                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-6 py-2.5 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition whitespace-nowrap">+ Add Entry</button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-12">Pos</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Team</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">P</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">W</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">D</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">L</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">PF</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">PA</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">PD</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">PCT</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">L5</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {standings.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50 transition">
                                    <td className="px-4 py-3 font-black text-sffl-navy">{s.position}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {s.team?.logo && <img src={s.team.logo} alt={s.team?.name} className="w-6 h-6 object-contain" />}
                                            <span className="font-semibold text-sm">{s.team?.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm">{s.played ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.won ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.drawn ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.lost ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.goals_for ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.goals_against ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm font-semibold">{(s.goal_diff ?? 0) > 0 ? '+' : ''}{s.goal_diff ?? 0}</td>
                                    <td className="px-4 py-3 text-center text-sm">{s.pct != null ? `${s.pct}%` : '-'}</td>
                                    <td className="px-4 py-3 text-center text-xs font-mono">{s.l5 || '-'}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 font-bold text-sm">Edit</button>
                                        <button onClick={() => setDeleteConfirm(s.id)} className="text-red-600 hover:text-red-800 font-bold text-sm">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {standings.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">No standings data for this competition</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b"><h2 className="text-2xl font-black text-sffl-navy">{editingId ? 'Edit Standing' : 'Add Standing'}</h2></div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Team *</label>
                                    <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Select...</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Position *</label>
                                    <input type="number" value={form.position} onChange={e => set('position', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">W</label><input type="number" value={form.won} onChange={e => set('won', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">D</label><input type="number" value={form.drawn} onChange={e => set('drawn', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">L</label><input type="number" value={form.lost} onChange={e => set('lost', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">PF (Points For)</label><input type="number" value={form.goals_for} onChange={e => set('goals_for', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">PA (Points Against)</label><input type="number" value={form.goals_against} onChange={e => set('goals_against', e.target.value)} className="w-full border rounded-lg px-3 py-2" min="0" /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Last 5 Games</label>
                                <div className="flex gap-2">
                                    {(['l5_1', 'l5_2', 'l5_3', 'l5_4', 'l5_5'] as const).map((field, i) => (
                                        <select
                                            key={i}
                                            value={form[field]}
                                            onChange={e => set(field, e.target.value)}
                                            className={`w-14 h-10 border rounded-lg text-center font-black text-sm cursor-pointer transition ${l5Color(form[field])}`}
                                        >
                                            {L5_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Select result for each of the last 5 games (most recent first)</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                                <strong>Auto-computed:</strong> P (W+D+L), PD (PF−PA), PCT (W÷P × 100)
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg font-bold hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy mb-2">Delete Standing?</h3>
                        <p className="text-gray-600 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
