import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    getTeams,
    getMatches,
    getStandings,
    getCompetitions,
    getPlayers,
    sortCompetitionsBySeason,
    type Team,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';

// Team Hub — lightweight navigation page for a single team. Header shows the
// team's current standing snapshot; the 4 quick-links route into the global
// Players / Stats / Standings / Matches pages pre-scoped to this team.
export const TeamDetail = () => {
    const { id } = useParams<{ id: string }>();

    // The team's basic info comes from the full teams list (the public API
    // doesn't expose a single-team endpoint). The list is small so this is fine.
    const { data: teamsData, isLoading: loadingTeam } = useQuery({
        queryKey: ['publicTeamsForDetail'],
        queryFn: () => getTeams(1, 100),
    });
    const team: Team | undefined = teamsData?.data?.find(t => t.id === id);

    // Pick the team's current competition by looking at the most recent match
    // they played; this gives us a sensible default for the standings widget
    // and the Standings quick-link's ?comp= param.
    const { data: matchesPage } = useQuery({
        queryKey: ['publicTeamCurrentComp', id],
        // Filtered by club server-side, so this is the team's own latest match
        // rather than the league's. Scanning the last 50 league-wide matches and
        // narrowing here meant a club that hadn't played recently found nothing
        // and silently fell back to the first active competition's standings.
        queryFn: () => getMatches(undefined, 1, 1, undefined, undefined, id),
        enabled: !!id,
    });
    const teamCompetitionId = (matchesPage?.data || [])[0]?.competition?.id;

    const { data: competitionsData } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const fallbackCompetitionId = (competitionsData?.data || [])
        .find(c => c.status !== 'inactive')?.id;
    const standingCompetitionId = teamCompetitionId || fallbackCompetitionId;

    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

    const competitions = sortCompetitionsBySeason(
        (competitionsData?.data || []).filter(c => c.status !== 'inactive')
    );
    const leagueComps = competitions.filter(c => c.format !== 'KNOCKOUT');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    
    // Find linked playoff for selected comp
    const linkedPlayoff = selectedComp?.playoff_competition_id
        ? competitions.find(c => c.id === selectedComp.playoff_competition_id)
        : null;

    // Reverse: if currently on a KNOCKOUT, find its parent league
    const parentLeague = !linkedPlayoff
        ? competitions.find(c => c.playoff_competition_id === selectedCompetitionId)
        : null;

    const dropdownComps = leagueComps.slice();
    if (selectedComp && selectedComp.format === 'KNOCKOUT') {
        if (!dropdownComps.some(c => c.id === selectedComp.id)) {
            dropdownComps.push(selectedComp);
        }
    }

    useEffect(() => {
        if (!selectedCompetitionId && standingCompetitionId) {
            setTimeout(() => {
                setSelectedCompetitionId(standingCompetitionId);
            }, 0);
        }
    }, [standingCompetitionId, selectedCompetitionId]);

    const activeCompetitionId = selectedCompetitionId || standingCompetitionId;

    const { data: standings } = useQuery({
        queryKey: ['publicStandings', activeCompetitionId],
        queryFn: () => getStandings(activeCompetitionId!),
        enabled: !!activeCompetitionId,
    });
    const teamStanding = standings?.find(s => s.team?.id === id);

    const { data: playersData, isLoading: loadingPlayers } = useQuery({
        queryKey: ['publicTeamPlayers', id],
        queryFn: () => getPlayers(id, 1, 100, undefined, 'all'),
        enabled: !!id,
    });
    const players = playersData?.data || [];
    const mainSquad = players.filter(p => !p.is_reserve);
    const reserveSquad = players.filter(p => p.is_reserve);

    if (loadingTeam) return <Loader />;

    if (!team) {
        return (
            <div className="space-y-6">
                <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                    <h1 className="text-3xl md:text-5xl font-black italic">TEAM</h1>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                    <div className="text-4xl mb-3">🛡️</div>
                    <p className="text-gray-500 text-lg font-semibold">Team not found.</p>
                    <Link to="/teams" className="text-sffl-red font-bold mt-4 inline-block">← Back to Teams</Link>
                </div>
            </div>
        );
    }

    // Pre-scope the standings link to the same competition we used to pick
    // teamStanding, so the highlighted row lines up with what's shown here.
    const standingsHref = activeCompetitionId
        ? `/standings?comp=${activeCompetitionId}&team=${team.id}`
        : `/standings?team=${team.id}`;

    return (
        <div className="space-y-6 md:space-y-8 pb-36 md:pb-16">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div className="flex items-center gap-4 md:gap-6">
                    {team.logo ? (
                        <img
                            src={team.logo}
                            alt={team.name}
                            className="w-20 h-20 md:w-28 md:h-28 object-contain rounded-lg bg-white/10 p-2"
                        />
                    ) : (
                        <div className="w-20 h-20 md:w-28 md:h-28 bg-white/10 rounded-lg flex items-center justify-center text-3xl md:text-4xl font-black">
                            {team.short_name?.toUpperCase() || team.name.substring(0, 3).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">{team.name.toUpperCase()}</h1>
                        {team.short_name && <p className="text-gray-300 mt-1 text-sm md:text-lg font-bold tracking-wider">{team.short_name.toUpperCase()}</p>}
                        {teamStanding && (
                            <div className="flex flex-wrap gap-2 md:gap-3 mt-3">
                                <span className="text-[10px] md:text-xs bg-sffl-red text-white font-black uppercase tracking-wider px-3 py-1 rounded-full">
                                    #{teamStanding.position}
                                </span>
                                <span className="text-[10px] md:text-xs bg-white/10 text-white font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                    {teamStanding.won}W · {teamStanding.drawn}D · {teamStanding.lost}L
                                </span>
                                <span className="text-[10px] md:text-xs bg-white/10 text-white font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                    {teamStanding.goals_for} PF · {teamStanding.goals_against} PA
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Competition Selector */}
                {competitions.length > 0 && (
                    <div className="mt-3 md:mt-0 w-full md:w-auto flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                            <div className="relative">
                                <select
                                    value={selectedCompetitionId}
                                    onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                    className="w-full appearance-none bg-white/10 border border-white/20 text-white py-2 px-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sffl-red font-bold text-sm cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    {dropdownComps.map((c) => (
                                        <option key={c.id} value={c.id} className="text-black bg-white">
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        {(linkedPlayoff || parentLeague) && (
                            <button
                                onClick={() => setSelectedCompetitionId(linkedPlayoff ? linkedPlayoff.id : parentLeague!.id)}
                                className="px-4 py-2 h-[38px] bg-sffl-red text-white font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap text-xs w-full sm:w-auto"
                            >
                                {linkedPlayoff ? (
                                    <>
                                        <span>🏆</span> Switch to Playoffs
                                    </>
                                ) : (
                                    <>
                                        <span>←</span> Back to Season
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Quick Links ────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 md:gap-3">
                <Link
                    to={activeCompetitionId ? `/stats?comp=${activeCompetitionId}&team=${team.id}` : `/stats?team=${team.id}`}
                    className="bg-white dark:bg-gray-800 hover:bg-sffl-navy hover:text-white dark:hover:bg-sffl-navy border border-gray-100 dark:border-gray-700 rounded-xl p-3 md:p-4 text-center transition-all group shadow-sm hover:shadow-md"
                >
                    <div className="text-xl md:text-2xl mb-1">📊</div>
                    <div className="text-[10px] md:text-xs uppercase font-black tracking-wider text-sffl-navy dark:text-white group-hover:text-white">Stats</div>
                </Link>
                <Link
                    to={standingsHref}
                    className="bg-white dark:bg-gray-800 hover:bg-sffl-navy hover:text-white dark:hover:bg-sffl-navy border border-gray-100 dark:border-gray-700 rounded-xl p-3 md:p-4 text-center transition-all group shadow-sm hover:shadow-md"
                >
                    <div className="text-xl md:text-2xl mb-1">🏆</div>
                    <div className="text-[10px] md:text-xs uppercase font-black tracking-wider text-sffl-navy dark:text-white group-hover:text-white">Standings</div>
                </Link>
                <Link
                    to={activeCompetitionId ? `/matches?comp=${activeCompetitionId}&team=${team.id}` : `/matches?team=${team.id}`}
                    className="bg-white dark:bg-gray-800 hover:bg-sffl-navy hover:text-white dark:hover:bg-sffl-navy border border-gray-100 dark:border-gray-700 rounded-xl p-3 md:p-4 text-center transition-all group shadow-sm hover:shadow-md"
                >
                    <div className="text-xl md:text-2xl mb-1">🏈</div>
                    <div className="text-[10px] md:text-xs uppercase font-black tracking-wider text-sffl-navy dark:text-white group-hover:text-white">Matches</div>
                </Link>
            </div>

            {/* ── Team Roster ─────────────────────────────────────────────── */}
            <div className="space-y-6 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                            <span className="text-sffl-red">●</span> TEAM ROSTER
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            Official team roster with 25-player main squad and active reserves.
                        </p>
                    </div>
                    {players.length > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-400">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Main: {mainSquad.length}/25
                            </span>
                            {reserveSquad.length > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    Reserves: {reserveSquad.length}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {loadingPlayers ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : players.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500">
                        No players listed for this team yet.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Main Squad Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                                    <span>⭐ Main Squad</span>
                                    <span className="text-xs text-gray-400 font-normal">({mainSquad.length}/25)</span>
                                </h3>
                            </div>
                            {mainSquad.length === 0 ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center text-gray-400 text-sm border border-gray-100 dark:border-gray-700">
                                    No players assigned to main squad.
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                                    {mainSquad.map((player) => (
                                        <div
                                            key={player.id}
                                            className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-start sm:items-center gap-4 min-w-0">
                                                {/* Player Picture Thumbnail (Left-most) */}
                                                {player.image ? (
                                                    <img
                                                        src={player.image}
                                                        alt={player.name}
                                                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-sffl-navy/10 dark:bg-sffl-navy/50 border border-sffl-navy/20 dark:border-gray-700 flex items-center justify-center text-lg font-black text-sffl-navy dark:text-gray-200 flex-shrink-0">
                                                        #{player.jersey_number || '?'}
                                                    </div>
                                                )}

                                                {/* Player Info */}
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link
                                                            to={`/players/${player.id}?team=${team.id}`}
                                                            className="text-base sm:text-lg font-black text-sffl-navy dark:text-white hover:text-sffl-red dark:hover:text-sffl-red transition-colors truncate uppercase"
                                                        >
                                                            {player.name}
                                                        </Link>
                                                        {player.jersey_number > 0 && (
                                                            <span className="bg-sffl-red/10 text-sffl-red px-2 py-0.5 rounded-md text-xs font-black">
                                                                #{player.jersey_number}
                                                            </span>
                                                        )}
                                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                                                            {player.position}
                                                        </span>
                                                        {player.gender && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                                                player.gender === 'F'
                                                                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                            }`}>
                                                                {player.gender === 'F' ? 'Female (F)' : 'Male (M)'}
                                                            </span>
                                                        )}
                                                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                                                            ⭐ Main
                                                        </span>
                                                    </div>

                                                    {player.bio && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                                                            "{player.bio}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Link */}
                                            <div className="flex items-center self-start sm:self-auto flex-shrink-0">
                                                <Link
                                                    to={`/players/${player.id}?team=${team.id}`}
                                                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sffl-red hover:text-[#A52323] px-3.5 py-2 rounded-xl bg-sffl-red/5 hover:bg-sffl-red/10 dark:bg-sffl-red/10 dark:hover:bg-sffl-red/20 border border-sffl-red/20 transition-all group"
                                                >
                                                    <span>Profile</span>
                                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Reserves Section (if any) */}
                        {reserveSquad.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-2">
                                        <span>🛡️ Reserve Squad</span>
                                        <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">({reserveSquad.length})</span>
                                    </h3>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                                    {reserveSquad.map((player) => (
                                        <div
                                            key={player.id}
                                            className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-start sm:items-center gap-4 min-w-0">
                                                {/* Player Picture Thumbnail (Left-most) */}
                                                {player.image ? (
                                                    <img
                                                        src={player.image}
                                                        alt={player.name}
                                                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-lg font-black text-amber-600 dark:text-amber-400 flex-shrink-0">
                                                        #{player.jersey_number || '?'}
                                                    </div>
                                                )}

                                                {/* Player Info */}
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link
                                                            to={`/players/${player.id}?team=${team.id}`}
                                                            className="text-base sm:text-lg font-black text-sffl-navy dark:text-white hover:text-sffl-red dark:hover:text-sffl-red transition-colors truncate uppercase"
                                                        >
                                                            {player.name}
                                                        </Link>
                                                        {player.jersey_number > 0 && (
                                                            <span className="bg-sffl-red/10 text-sffl-red px-2 py-0.5 rounded-md text-xs font-black">
                                                                #{player.jersey_number}
                                                            </span>
                                                        )}
                                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-xs font-extrabold uppercase">
                                                            {player.position}
                                                        </span>
                                                        {player.gender && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                                                                player.gender === 'F'
                                                                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                            }`}>
                                                                {player.gender === 'F' ? 'Female (F)' : 'Male (M)'}
                                                            </span>
                                                        )}
                                                        <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                                                            🛡️ Reserve
                                                        </span>
                                                    </div>

                                                    {player.bio && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                                                            "{player.bio}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Link */}
                                            <div className="flex items-center self-start sm:self-auto flex-shrink-0">
                                                <Link
                                                    to={`/players/${player.id}?team=${team.id}`}
                                                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sffl-red hover:text-[#A52323] px-3.5 py-2 rounded-xl bg-sffl-red/5 hover:bg-sffl-red/10 dark:bg-sffl-red/10 dark:hover:bg-sffl-red/20 border border-sffl-red/20 transition-all group"
                                                >
                                                    <span>Profile</span>
                                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};
