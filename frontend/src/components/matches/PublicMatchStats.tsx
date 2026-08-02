import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStatsCompare, type TeamStat } from '../../services/api';
import { StatsTable } from '../stats/StatsTable';
import { Spinner } from '../ui';

export const PublicMatchStats = ({ matchId }: { matchId: string }) => {
    const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

    const { data, isLoading, isError } = useQuery({
        queryKey: ['publicMatchStatsCompare', matchId],
        queryFn: () => getStatsCompare(matchId),
        enabled: !!matchId,
    });

    const derived = data?.derived || data?.current || [];

    // Extract unique teams involved in this match from derived player stats
    const teamsList = useMemo(() => {
        const map: Record<string, { id: string; name: string; shortName: string }> = {};
        derived.forEach(p => {
            if (p.team_id && !map[p.team_id]) {
                map[p.team_id] = {
                    id: p.team_id,
                    name: p.team_name || 'Team',
                    shortName: p.team_short_name || p.team_name || 'Team',
                };
            }
        });
        return Object.values(map);
    }, [derived]);

    // Derived team stats aggregated from derived player stats
    const derivedTeamStats: TeamStat[] = useMemo(() => {
        const map: Record<string, TeamStat> = {};
        derived.forEach(p => {
            if (!p.team_id) return;
            if (!map[p.team_id]) {
                map[p.team_id] = {
                    team_id: p.team_id,
                    team_name: p.team_name || '',
                    team_short_name: p.team_short_name || '',
                    team_logo: p.team_logo || '',
                    passing_attempts: 0,
                    rushing_attempts: 0,
                    completed_passes: 0,
                    passing_tds: 0,
                    rushing_tds: 0,
                    interceptions_thrown: 0,
                    receptions: 0,
                    receiving_tds: 0,
                    extra_points_tds: 0,
                    drops: 0,
                    flag_pulls: 0,
                    pass_deflections: 0,
                    interceptions: 0,
                    defensive_tds: 0,
                    safety: 0,
                    qb_sacks: 0,
                    def_sacks: 0,
                    defensive_xp_tds: 0,
                    incomplete_passes: 0,
                    uncatchable_passes: 0,
                    thrown_away_passes: 0,
                    batted_down_passes: 0,
                    targets: 0,
                    passing_yards: 0,
                    rushing_yards: 0,
                    receiving_yards: 0,
                    xp_attempts: 0,
                    xp_good: 0,
                    xp_fail: 0,
                    safety_conceded: 0,
                    punts: 0,
                    first_downs: 0,
                    turnovers: 0,
                    penalties: 0,
                    penalty_yards: 0,
                    total_plays: 0,
                };
            }
            const t = map[p.team_id];
            t.passing_attempts += p.passing_attempts || 0;
            t.rushing_attempts += p.rushing_attempts || 0;
            t.completed_passes += p.completed_passes || 0;
            t.incomplete_passes += p.incomplete_passes || 0;
            t.uncatchable_passes += p.uncatchable_passes || 0;
            t.thrown_away_passes += p.thrown_away_passes || 0;
            t.batted_down_passes += p.batted_down_passes || 0;
            t.targets += p.targets || 0;
            t.passing_yards += p.passing_yards || 0;
            t.rushing_yards += p.rushing_yards || 0;
            t.receiving_yards += p.receiving_yards || 0;
            t.passing_tds += p.passing_tds || 0;
            t.rushing_tds += p.rushing_tds || 0;
            t.interceptions_thrown += p.interceptions_thrown || 0;
            t.receptions += p.receptions || 0;
            t.receiving_tds += p.receiving_tds || 0;
            t.extra_points_tds += p.extra_points_tds || 0;
            t.xp_attempts += p.xp_attempts || 0;
            t.xp_good += p.xp_good || 0;
            t.xp_fail += p.xp_fail || 0;
            t.drops += p.drops || 0;
            t.flag_pulls += p.flag_pulls || 0;
            t.pass_deflections += p.pass_deflections || 0;
            t.interceptions += p.interceptions || 0;
            t.defensive_tds += p.defensive_tds || 0;
            t.safety += p.safety || 0;
            t.safety_conceded += p.safety_conceded || 0;
            t.qb_sacks += p.qb_sacks || 0;
            t.def_sacks += p.def_sacks || 0;
            t.defensive_xp_tds += p.defensive_xp_tds || 0;
        });
        return Object.values(map);
    }, [derived]);

    // Filter player stats by team selection
    const filteredPlayerStats = useMemo(() => {
        if (selectedTeamId === 'all') return derived;
        return derived.filter(p => p.team_id === selectedTeamId);
    }, [derived, selectedTeamId]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 py-14 text-center">
                <Spinner label="Loading match statistics…" className="py-6" />
            </div>
        );
    }

    if (isError || derived.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 py-14 text-center">
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">No match stats recorded for this game yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Controls Bar: Sub-tabs (Player vs Team) + Team Filter Pills */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                {/* Player vs Team Sub-tabs */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('players')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${activeTab === 'players' ? 'bg-sffl-navy text-white dark:bg-sffl-red' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        Player Stats ({derived.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${activeTab === 'teams' ? 'bg-sffl-navy text-white dark:bg-sffl-red' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        Team Stats ({derivedTeamStats.length})
                    </button>
                </div>

                {/* Team Filter Pills (Player Stats view only) */}
                {activeTab === 'players' && teamsList.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-400 mr-1">Filter Team:</span>
                        <button
                            type="button"
                            onClick={() => setSelectedTeamId('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selectedTeamId === 'all' ? 'bg-sffl-red text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'}`}
                        >
                            All Teams
                        </button>
                        {teamsList.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setSelectedTeamId(t.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selectedTeamId === t.id ? 'bg-sffl-red text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'}`}
                            >
                                {t.shortName}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Render Stats Table */}
            {activeTab === 'players' ? (
                <StatsTable type="players" playerStats={filteredPlayerStats} />
            ) : (
                <StatsTable type="teams" teamStats={derivedTeamStats} />
            )}
        </div>
    );
};
