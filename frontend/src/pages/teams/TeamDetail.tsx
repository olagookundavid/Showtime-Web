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
        queryFn: () => getMatches(undefined, 1, 50),
        enabled: !!id,
    });
    const teamMatches = (matchesPage?.data || []).filter(
        m => m.home_team?.id === id || m.away_team?.id === id
    );
    const teamCompetitionId = teamMatches[0]?.competition?.id;

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
        queryFn: () => getPlayers(id, 1, 100),
        enabled: !!id,
    });
    const players = playersData?.data || [];

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
        <div className="space-y-6 md:space-y-8 pb-16">
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
            <div className="space-y-4 pt-4">
                <h2 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                    <span className="text-sffl-red">●</span> TEAM ROSTER
                </h2>
                {loadingPlayers ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : players.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500">
                        No players listed for this team yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                        {players.map((player) => (
                            <Link
                                key={player.id}
                                to={`/players/${player.id}?team=${team.id}`}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-99 transition-all overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col group"
                            >
                                {/* Player Image */}
                                <div className="relative h-32 sm:h-48 overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                                    {player.image ? (
                                        <img
                                            src={player.image}
                                            alt={player.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="text-sffl-navy/40 dark:text-white/30 text-xl md:text-3xl font-black">
                                            #{player.jersey_number}
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-sffl-red text-white font-black text-[9px] md:text-xs px-2 py-0.5 rounded-full shadow">
                                        #{player.jersey_number}
                                    </div>
                                </div>
                                {/* Player Info */}
                                <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xs md:text-base font-black text-sffl-navy dark:text-white truncate uppercase">{player.name}</h3>
                                        <div className="text-[10px] md:text-xs text-sffl-red font-bold truncate mt-0.5 uppercase">
                                            {player.position}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sffl-red font-bold text-[9px] md:text-xs uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        Profile <span>→</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
