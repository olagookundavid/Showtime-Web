import { useState, useMemo, useCallback } from 'react';
import { isDeletedPlayer, deletedRowClass, DeletedPlayerName } from '../../components/common/DeletedPlayer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api, { moveToReserve, graduatePlayer, getTeamRosterSummary, type RosterSummary } from '../../services/api';
import { Button, Field, Input, LightboxImage, ImageUploadField, Select, Textarea } from '../../components/ui';
import toast from 'react-hot-toast';
import {
    ArrowDownCircleIcon,
    ArrowTrendingUpIcon,
    ArrowUpCircleIcon,
    ArrowsRightLeftIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    PencilSquareIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline';
import { PlayerPriceHistoryModal } from '../../components/fantasy/PlayerPriceHistoryModal';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Modal } from '../../components/ui/Modal';
import { useTeamHeadTeam } from '../../components/team-head/useTeamHeadTeam';
import { getApiErrorMessage } from '../../utils/apiError';

interface Player {
    id: string;
    name: string;
    position: string;
    secondary_position?: string;
    gender?: string;
    jersey_number: number;
    email?: string;
    image: string;
    team_id: string;
    bio: string;
    is_reserve?: boolean;
    /** 'active' | 'inactive'. Deleting only deactivates (migration 088). */
    status?: string;
}

interface PaginatedPlayerResponse {
    data: Player[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

type RosterTab = 'main' | 'reserve' | 'all';

type PendingAction =
    | { kind: 'save' }
    | { kind: 'reserve'; player: Player }
    | { kind: 'graduate'; player: Player };

// Center is rated identically to Receiver (same formula) — see
// backend/internal/domain/player_rating.go RateByPosition.
const POSITIONS = ['Defender', 'Receiver', 'Center', 'QB', 'Rusher', 'Allrounder', '-'];
// All-Rounder already means "plays anywhere", so it says nothing as a second
// role — it is a main role only, and the server refuses it as a secondary.
const SECONDARY_POSITIONS = POSITIONS.filter(p => p !== 'Allrounder' && p !== '-');
const PAGE_SIZES = [10, 20, 50, 100, 200, 500, 800, 1000];
const NO_PLAYERS: Player[] = [];
const FULL_SQUAD_HINT = 'Main squad is at capacity (25/25). Move an active player to reserves first.';

const emptyForm = {
    name: '', position: '-', secondary_position: '', gender: '', jersey_number: '', email: '', image: '', bio: '',
};

const TeamHeadPlayers = () => {
    const team = useTeamHeadTeam();
    const queryClient = useQueryClient();

    // Pagination, Search & Squad Tab States
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState('');
    const [rosterTab, setRosterTab] = useState<RosterTab>('main');

    // Team Roster Capacity Summary (25-Cap enforcement)
    const { data: rosterSummary } = useQuery<RosterSummary>({
        queryKey: ['teamRosterSummary', team?.id],
        queryFn: () => getTeamRosterSummary(team!.id),
        enabled: !!team?.id,
    });

    // Locked to team.id (manager's own team) with full pagination, search & roster tab
    const { data: responseData, isLoading: loading, error: queryError } = useQuery<PaginatedPlayerResponse>({
        queryKey: ['teamHeadPlayers', team?.id, page, limit, search, rosterTab],
        queryFn: async () => {
            const res = await api.get('/team-head/players', {
                params: {
                    team_id: team!.id, // Locked to manager's assigned team
                    page,
                    limit,
                    search,
                    roster_status: rosterTab === 'all' ? undefined : rosterTab,
                },
            });
            return res.data;
        },
        enabled: !!team?.id,
    });

    const players = responseData?.data ?? NO_PLAYERS;
    const totalPlayers = responseData?.total || 0;
    const totalPages = responseData?.total_pages || 1;
    const currentPage = responseData?.page || page;

    const error = queryError ? getApiErrorMessage(queryError, 'Failed to fetch players.') : '';

    // Edit form, price history, and the write waiting on the confirm dialog
    const [editing, setEditing] = useState<Player | null>(null);
    const [priceHistoryPlayer, setPriceHistoryPlayer] = useState<Player | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const squadFull = !!rosterSummary && !rosterSummary.can_add_or_promote;

    const openEdit = useCallback((p: Player) => {
        setEditing(p);
        setForm({
            name: p.name || '',
            position: p.position || '-',
            secondary_position: p.secondary_position || '',
            gender: p.gender || '',
            jersey_number: p.jersey_number?.toString() || '0',
            email: p.email || '',
            image: p.image || '',
            bio: p.bio || '',
        });
    }, []);

    // The modal only ever edits. Managers cannot create or delete players — a new
    // player joins through an approved account claim (see TeamHeadClaims).
    const submitEdit = () => {
        if (!form.name.trim()) {
            toast.error('Name is required.');
            return;
        }
        if (form.secondary_position && form.secondary_position === form.position) {
            toast.error('Secondary position cannot be the same as primary position.');
            return;
        }
        setPendingAction({ kind: 'save' });
    };

    const refreshRoster = () => {
        if (!team) return;
        queryClient.invalidateQueries({ queryKey: ['teamHeadPlayers', team.id] });
        queryClient.invalidateQueries({ queryKey: ['teamRosterSummary', team.id] });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action || !team) return;
        setBusy(true);
        try {
            switch (action.kind) {
                case 'save': {
                    if (!editing) return;
                    const payload = {
                        name: form.name,
                        position: form.position && form.position.trim() ? form.position.trim() : '-',
                        secondary_position: form.secondary_position || undefined,
                        gender: form.gender,
                        jersey_number: parseInt(form.jersey_number) || 0,
                        email: form.email,
                        image: form.image,
                        bio: form.bio,
                        team_id: team.id,
                    };
                    await api.put(`/team-head/players/${editing.id}`, payload);
                    toast.success('Player updated successfully');
                    setEditing(null);
                    break;
                }
                case 'reserve':
                    await moveToReserve(action.player.id);
                    toast.success(`${action.player.name} moved to Reserve Squad`);
                    break;
                case 'graduate':
                    await graduatePlayer(action.player.id);
                    toast.success(`${action.player.name} graduated to Main Squad!`);
                    break;
            }
            refreshRoster();
        } catch (err) {
            const fallback = {
                save: 'Failed to save player.',
                reserve: 'Failed to move player to reserve.',
                graduate: 'Failed to graduate player to main squad.',
            }[action.kind];
            toast.error(getApiErrorMessage(err, fallback));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

    const switchTab = (tab: RosterTab) => {
        setRosterTab(tab);
        setPage(1);
    };

    // Player leads because the first column stays frozen when the table scrolls sideways.
    const columns = useMemo<Column<Player>[]>(() => [
        {
            header: 'Player',
            cell: (p) => {
                const deleted = isDeletedPlayer(p);
                return (
                    <div className={`flex items-center gap-3 ${deletedRowClass(deleted)}`}>
                        {p.image ? (
                            <LightboxImage
                                src={p.image}
                                alt={p.name}
                                thumbnailClassName="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-200 shrink-0">
                                #{p.jersey_number || '?'}
                            </div>
                        )}
                        <div className="flex flex-col min-w-0">
                            {deleted ? (
                                <DeletedPlayerName name={p.name} deleted showLabel className="font-semibold text-sm" />
                            ) : (
                                <span className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word">{p.name}</span>
                            )}
                            {p.email && <span className="text-xs text-gray-400 truncate max-w-45">{p.email}</span>}
                        </div>
                    </div>
                );
            },
        },
        {
            header: '#',
            className: 'px-4 py-3 w-16',
            cell: (p) => <span className="font-bold text-sm dark:text-gray-300">{p.jersey_number || '—'}</span>,
        },
        {
            header: 'Position',
            cell: (p) => (
                <div className="flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-md text-xs font-bold dark:text-gray-300">
                        {p.position || 'N/A'}
                    </span>
                    {p.secondary_position && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-extrabold whitespace-nowrap">
                            Sec: {p.secondary_position}
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: 'Gender',
            cell: (p) => (
                <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                    p.gender === 'F'
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                        : p.gender === 'M'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                    {p.gender === 'F' ? 'Female (F)' : p.gender === 'M' ? 'Male (M)' : p.gender || '—'}
                </span>
            ),
        },
        {
            header: 'Squad',
            cell: (p) =>
                p.is_reserve ? (
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Reserve
                    </span>
                ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Main
                    </span>
                ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (p) => (
                <RowActions
                    label={`Actions for ${p.name}`}
                    actions={[
                        p.is_reserve
                            ? {
                                label: 'Graduate to main squad',
                                icon: ArrowUpCircleIcon,
                                disabled: squadFull,
                                hint: squadFull ? FULL_SQUAD_HINT : undefined,
                                onSelect: () => setPendingAction({ kind: 'graduate', player: p }),
                            }
                            : {
                                label: 'Move to reserves',
                                icon: ArrowDownCircleIcon,
                                onSelect: () => setPendingAction({ kind: 'reserve', player: p }),
                            },
                        { label: 'Edit', icon: PencilSquareIcon, onSelect: () => openEdit(p) },
                        { label: 'Price history', icon: ArrowTrendingUpIcon, onSelect: () => setPriceHistoryPlayer(p) },
                    ]}
                />
            ),
        },
    ], [openEdit, squadFull]);

    if (!team) {
        return (
            <div className="text-center py-20">
                <p className="text-2xl font-black text-gray-400 dark:text-gray-500">No team assigned</p>
                <p className="text-gray-500 mt-2">Contact an admin to get assigned to a team.</p>
            </div>
        );
    }

    const playerRows = (p: Player): [string, string | undefined][] => [
        ['Player', p.name],
        ['Jersey', p.jersey_number ? `#${p.jersey_number}` : undefined],
        ['Position', p.position],
    ];

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'reserve':
                return {
                    title: `Move ${pendingAction.player.name} to the reserve squad?`,
                    description: 'They can\'t be picked for match team sheets until you graduate them back to the main squad.',
                    confirmLabel: 'Move to Reserve',
                    tone: 'info' as const,
                    icon: ArrowDownCircleIcon,
                    body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
                };
            case 'graduate':
                return {
                    title: `Promote ${pendingAction.player.name} to the main squad?`,
                    description: 'They move from the reserves to the main squad and take one of its 25 places.',
                    confirmLabel: 'Graduate',
                    tone: 'success' as const,
                    icon: ArrowUpCircleIcon,
                    body: <ConfirmSummary rows={playerRows(pendingAction.player)} />,
                };
            default:
                return {
                    title: 'Save changes to this player?',
                    description: undefined,
                    confirmLabel: 'Save Changes',
                    tone: 'info' as const,
                    icon: PencilSquareIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Player', form.name],
                            ['Jersey', form.jersey_number ? `#${form.jersey_number}` : undefined],
                            ['Position', form.secondary_position ? `${form.position} (Sec: ${form.secondary_position})` : form.position],
                        ]} />
                    ),
                };
        }
    })();

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Players"
                subtitle={<>View and manage the <span className="font-bold">{team.name}</span> roster and reserves.</>}
                actions={
                    <>
                        <Link
                            to="/team-head/transfers"
                            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-11 px-4 bg-sffl-navy hover:bg-[#001730] text-white font-bold rounded-lg shadow-sm text-sm transition-colors"
                        >
                            <ArrowsRightLeftIcon className="w-4 h-4" aria-hidden="true" />
                            Transfer Market
                        </Link>
                        <Link
                            to="/team-head/contracts"
                            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-11 px-4 bg-sffl-red hover:bg-[#A52323] text-white font-bold rounded-lg shadow-sm text-sm transition-colors"
                        >
                            <UserPlusIcon className="w-4 h-4" aria-hidden="true" />
                            Sign Free Agent
                        </Link>
                    </>
                }
            />

            {/* Roster Capacity Meter & Status Banner */}
            {rosterSummary && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-sm font-black text-sffl-navy dark:text-white flex flex-wrap items-center gap-2">
                                <span>Squad Roster Status & Capacity</span>
                                {rosterSummary.main_count > rosterSummary.max_main_limit ? (
                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        <ExclamationTriangleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                        Over Limit ({rosterSummary.main_count}/{rosterSummary.max_main_limit})
                                    </span>
                                ) : rosterSummary.main_count === rosterSummary.max_main_limit ? (
                                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        Full Capacity ({rosterSummary.max_main_limit}/{rosterSummary.max_main_limit})
                                    </span>
                                ) : (
                                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        {rosterSummary.max_main_limit - rosterSummary.main_count} Spot(s) Available
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Teams are capped at 25 main squad players. Reserves are unlimited and excluded from match team sheets until graduated.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">Main Squad</span>
                                <span className={`text-base font-black ${rosterSummary.main_count > 25 ? 'text-red-600' : 'text-sffl-navy dark:text-white'}`}>
                                    {rosterSummary.main_count} <span className="text-xs text-gray-400 font-normal">/ 25</span>
                                </span>
                            </div>
                            <div aria-hidden="true" className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">Reserves</span>
                                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                                    {rosterSummary.reserve_count} <span className="text-xs text-gray-400 font-normal">(unlimited)</span>
                                </span>
                            </div>
                            <div aria-hidden="true" className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                            <div className="text-center">
                                <span className="text-gray-400 block text-[10px] uppercase">All-Rounders</span>
                                <span className={`text-base font-black ${(rosterSummary.allrounder_count || 0) >= 6 ? 'text-amber-600 dark:text-amber-400' : 'text-sffl-navy dark:text-white'}`}>
                                    {rosterSummary.allrounder_count || 0} <span className="text-xs text-gray-400 font-normal">/ 6</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                rosterSummary.main_count > 25
                                    ? 'bg-red-600'
                                    : rosterSummary.main_count === 25
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (rosterSummary.main_count / 25) * 100)}%` }}
                        />
                    </div>

                    {/* Grandfathered Warning Banner if > 25 */}
                    {rosterSummary.main_count > rosterSummary.max_main_limit && (
                        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            <div>
                                <span className="font-bold">Grandfathered Roster Limit:</span> Your main squad currently holds{' '}
                                <strong>{rosterSummary.main_count} players</strong>, which exceeds the official 25-player cap. Existing players remain active, but you <strong>cannot sign new free agents, accept incoming transfers, or graduate reserves</strong> until you move at least <strong>{rosterSummary.main_count - rosterSummary.max_main_limit} player(s)</strong> to your reserve squad or release them.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Roster Registration Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 shadow-sm">
                <InformationCircleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <div>
                    <span className="font-bold">Adding a new player:</span> New players join by requesting a place themselves. Share your team code from{' '}
                    <Link to="/team-head/claims" className="font-bold underline">Account Claims</Link>; the player enters it at <span className="font-mono">/claim</span> and chooses <strong>“My name is not listed”</strong>. You confirm you know them, and the league office adds them to your squad. Players already in the league move through <strong>Free Agency</strong> or a <strong>Transfer Request</strong>.
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800/30 text-sm font-semibold">
                    {error}
                </div>
            )}

            {/* Filters: squad tabs and page size */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto">
                    <Button
                        variant={rosterTab === 'main' ? 'navy' : 'secondary'}
                        aria-pressed={rosterTab === 'main'}
                        onClick={() => switchTab('main')}
                    >
                        Main Squad
                        {rosterSummary && (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-black ${
                                rosterTab === 'main' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                                {rosterSummary.main_count}/25
                            </span>
                        )}
                    </Button>
                    <Button
                        variant={rosterTab === 'reserve' ? 'warning' : 'secondary'}
                        aria-pressed={rosterTab === 'reserve'}
                        onClick={() => switchTab('reserve')}
                    >
                        Reserves
                        {rosterSummary && (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-black ${
                                rosterTab === 'reserve' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}>
                                {rosterSummary.reserve_count}
                            </span>
                        )}
                    </Button>
                    <Button
                        variant={rosterTab === 'all' ? 'primary' : 'secondary'}
                        aria-pressed={rosterTab === 'all'}
                        onClick={() => switchTab('all')}
                    >
                        All Players
                    </Button>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <label className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap">Show</span>
                        <Select
                            aria-label="Players per page"
                            className="w-32"
                            value={limit}
                            onChange={e => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
                        </Select>
                    </label>
                    <span className="font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {totalPlayers} Total Players
                    </span>
                </div>
            </div>

            <DataTable
                data={players}
                columns={columns}
                getRowId={(p) => p.id}
                loading={loading}
                itemsPerPage={limit}
                serverPage={currentPage}
                totalServerPages={totalPages}
                onPageChange={setPage}
                searchPlaceholder="Search by name or position"
                onSearchSubmit={(term) => {
                    setSearch(term.trim());
                    setPage(1);
                }}
                emptyMessage={
                    search
                        ? `No players matching "${search}".`
                        : rosterTab === 'reserve'
                            ? 'No players currently in reserve squad. You can move players from the main squad into reserves at any time.'
                            : 'No players on roster yet. Share your team code from Account Claims so new players can request to join.'
                }
            />

            {/* Edit form. Escape and the backdrop leave it alone while its confirm is up. */}
            <Modal
                open={!!editing}
                onClose={() => { if (!pendingAction) setEditing(null); }}
                title="Edit Player"
                maxWidth="2xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                        <Button disabled={!form.name.trim()} onClick={submitEdit}>
                            Update Player
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Name *" htmlFor="player-name">
                            <Input id="player-name" type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Player Full Name" />
                        </Field>
                        <Field label="Jersey #" htmlFor="player-jersey">
                            <Input id="player-jersey" type="number" value={form.jersey_number} onChange={e => setField('jersey_number', e.target.value)} />
                        </Field>
                        <Field label="Email *" htmlFor="player-email">
                            <Input id="player-email" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="player@team.com" />
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Primary Role" htmlFor="player-position">
                            <Select
                                id="player-position"
                                value={form.position || '-'}
                                onChange={e => {
                                    const newPos = e.target.value;
                                    setField('position', newPos);
                                    if (form.secondary_position === newPos) setField('secondary_position', '');
                                }}
                            >
                                <option value="-">- (No Role / Unassigned)</option>
                                {POSITIONS.filter(p => p !== '-').map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </Field>
                        <Field
                            label={<>Secondary Role <span className="text-xs font-normal text-gray-400">(Optional)</span></>}
                            htmlFor="player-secondary-position"
                        >
                            <Select id="player-secondary-position" value={form.secondary_position} onChange={e => setField('secondary_position', e.target.value)}>
                                <option value="">None (No Secondary Role)</option>
                                {SECONDARY_POSITIONS.filter(p => p !== form.position).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Gender" htmlFor="player-gender">
                            <Select id="player-gender" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                <option value="">Select a gender</option>
                                <option value="M">Male (M)</option>
                                <option value="F">Female (F)</option>
                            </Select>
                        </Field>
                        <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 sm:pt-7">
                            <InformationCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span><strong>Allrounders Rule:</strong> Teams are limited to a maximum of 6 Allrounders (combined main & secondary roles).</span>
                        </p>
                    </div>
                    <ImageUploadField
                        label="Player Image"
                        value={form.image}
                        onChange={(url) => setField('image', url)}
                        folder="players"
                        helperText="Upload a profile photo."
                        isCommitted={busy}
                    />
                    <Field label="Bio" htmlFor="player-bio">
                        <Textarea id="player-bio" value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3} placeholder="A short bio" />
                    </Field>
                </div>
            </Modal>

            {priceHistoryPlayer && (
                <PlayerPriceHistoryModal
                    isOpen={!!priceHistoryPlayer}
                    onClose={() => setPriceHistoryPlayer(null)}
                    playerId={priceHistoryPlayer.id}
                    playerName={priceHistoryPlayer.name}
                    playerImage={priceHistoryPlayer.image}
                    position={priceHistoryPlayer.position}
                    teamName={team.name}
                />
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};

export default TeamHeadPlayers;
