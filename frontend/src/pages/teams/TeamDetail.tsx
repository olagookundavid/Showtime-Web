import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    getTeams,
    getMatches,
    getStandings,
    getCompetitions,
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

    const { data: standings } = useQuery({
        queryKey: ['publicStandings', standingCompetitionId],
        queryFn: () => getStandings(standingCompetitionId!),
        enabled: !!standingCompetitionId,
    });
    const teamStanding = standings?.find(s => s.team?.id === id);

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
    const standingsHref = standingCompetitionId
        ? `/standings?comp=${standingCompetitionId}&team=${team.id}`
        : `/standings?team=${team.id}`;

    return (
        <div className="space-y-6 md:space-y-8 pb-16">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
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
                <div className="flex-1">
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

            {/* ── Quick Links ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                <Link
                    to={`/players?team=${team.id}`}
                    className="bg-white dark:bg-gray-800 hover:bg-sffl-navy hover:text-white dark:hover:bg-sffl-navy border border-gray-100 dark:border-gray-700 rounded-xl p-3 md:p-4 text-center transition-all group shadow-sm hover:shadow-md"
                >
                    <div className="text-xl md:text-2xl mb-1">👥</div>
                    <div className="text-[10px] md:text-xs uppercase font-black tracking-wider text-sffl-navy dark:text-white group-hover:text-white">Players</div>
                </Link>
                <Link
                    to={`/stats?team=${team.id}`}
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
                    to={`/matches?team=${team.id}`}
                    className="bg-white dark:bg-gray-800 hover:bg-sffl-navy hover:text-white dark:hover:bg-sffl-navy border border-gray-100 dark:border-gray-700 rounded-xl p-3 md:p-4 text-center transition-all group shadow-sm hover:shadow-md"
                >
                    <div className="text-xl md:text-2xl mb-1">⚽</div>
                    <div className="text-[10px] md:text-xs uppercase font-black tracking-wider text-sffl-navy dark:text-white group-hover:text-white">Matches</div>
                </Link>
            </div>

        </div>
    );
};
