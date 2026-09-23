import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getMatchDetail, getPublicMatchStats } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { PlayByPlayTimeline } from '../../components/matches/PlayByPlayTimeline';
import { PublicMatchStats } from '../../components/matches/PublicMatchStats';
import { MatchSummaryTab, getUnifiedMatchMvp } from '../../components/matches/MatchSummaryTab';
import { MatchTeamSheetTab } from '../../components/matches/MatchTeamSheetTab';
import { CommentSection } from '../../components/comments/CommentSection';
import { BackButton } from '../../components/common/BackButton';
import { formatMatchTime, formatMatchDate } from '../../utils/dateUtils';

export const MatchDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const compParam = searchParams.get('comp');
    const teamParam = searchParams.get('team');

    const backLink = (() => {
        const params = new URLSearchParams();
        if (compParam) params.set('comp', compParam);
        if (teamParam) params.set('team', teamParam);
        const q = params.toString();
        return q ? `/matches?${q}` : '/matches';
    })();

    const { data: matchDetail, isLoading, isError } = useQuery({
        queryKey: ['publicMatchDetail', id],
        queryFn: () => getMatchDetail(id!),
        enabled: !!id,
        retry: 1,
    });

    const tabParam = searchParams.get('tab');
    type MatchTab = 'summary' | 'rating' | 'plays' | 'stats' | 'discussions';
    const initialTab: MatchTab = (tabParam === 'summary' || tabParam === 'discussions' || tabParam === 'plays' || tabParam === 'stats' || tabParam === 'rating') ? tabParam : 'summary';

    const [activeTab, setActiveTab] = useState<MatchTab>(initialTab);

    const { data: statsData } = useQuery({
        queryKey: ['publicMatchStatsCompare', id],
        queryFn: () => getPublicMatchStats(id!),
        enabled: !!id,
    });
    const playerStatsList = useMemo(() => statsData?.derived || statsData?.current || [], [statsData]);

    const match = matchDetail?.match;
    const team_sheet = matchDetail?.team_sheet;
    const unifiedMvp = useMemo(() => (match && team_sheet ? getUnifiedMatchMvp(match, team_sheet, playerStatsList) : null), [match, team_sheet, playerStatsList]);

    if (isLoading) return <Loader />;

    if (isError || !matchDetail) {
        return (
            <div className="text-center py-20 max-w-lg mx-auto px-4">
                <div className="text-6xl mb-6">🏈</div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white mb-3">Match Not Found</h1>
                <p className="text-gray-500 mb-8">This match could not be loaded. It may have been removed.</p>
                <BackButton fallback={backLink} className="inline-flex items-center gap-2 px-6 py-3 bg-sffl-red text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                    Back to Matches
                </BackButton>
            </div>
        );
    }

    if (!match?.id) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Match data unavailable.</p>
                <div className="mt-4">
                    <BackButton fallback={backLink}>Back to Matches</BackButton>
                </div>
            </div>
        );
    }

    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const isFinishedOrLive = match.status === 'FINISHED' || match.status === 'LIVE';

    const isBye = match.competition?.format === 'PLAYOFFS' &&
        ((match.home_team?.id && !match.away_team?.id && match.status === 'FINISHED') ||
         (!match.home_team?.id && match.away_team?.id && match.status === 'FINISHED'));

    const statusConfig = {
        LIVE:      { label: 'LIVE', cls: 'bg-red-500 animate-pulse' },
        FINISHED:  { label: 'FULL TIME', cls: 'bg-emerald-600' },
        SCHEDULED: { label: 'UPCOMING', cls: 'bg-blue-500' },
        POSTPONED: { label: 'POSTPONED', cls: 'bg-amber-500' },
    } as const;
    const statusInfo = isBye ? { label: 'PLAYOFF BYE', cls: 'bg-emerald-600' } : (statusConfig[match.status as keyof typeof statusConfig] ?? { label: match.status, cls: 'bg-gray-500' });

    return (
        <div className="space-y-4 md:space-y-8 pb-36 md:pb-16">

            {/* Back nav */}
            <div className="px-1">
                <BackButton fallback={backLink} />
            </div>

            {/* Match Card Header */}
            <div className="bg-sffl-navy rounded-2xl shadow-2xl overflow-hidden border border-white/5 relative">
                <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url('/images/card_pattern.svg')` }} />
                <div className="relative p-6 md:p-12">
                    {/* Competition + date */}
                    <div className="text-center mb-8">
                        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${statusInfo.cls} text-white mb-3`}>
                            {statusInfo.label}
                        </span>
                        <p className="text-gray-300 text-sm font-semibold flex items-center justify-center gap-2">
                            {match.competition?.logo && (
                                <img src={match.competition.logo} alt={match.competition.name} className="w-5 h-5 object-contain" />
                            )}
                            <span>{match.competition?.name}</span> {!isBye && ` • ${formatMatchDate(match.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
                        </p>
                        {match.venue && !isBye && (
                            <p className="text-gray-500 text-xs mt-1">📍 {match.venue}</p>
                        )}
                    </div>

                    {/* Teams + Score */}
                    <div className="flex items-center justify-between gap-2 md:gap-8">
                        {/* Home */}
                        <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                            <div className="w-16 h-16 md:w-28 md:h-28 bg-white rounded-full overflow-hidden shadow-xl ring-4 ring-white/10 flex-shrink-0 flex items-center justify-center">
                                {homeTeam?.logo ? (
                                    <LightboxImage 
                                        src={homeTeam.logo} 
                                        alt={homeTeam.name} 
                                        thumbnailClassName="w-full h-full"
                                        imgClassName="w-full h-full object-contain p-2 md:p-4"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-black text-gray-500">
                                        {homeTeam?.short_name?.slice(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                {homeTeam?.id ? (
                                    <Link to={`/teams/${homeTeam.id}`} className="block group/team">
                                        <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1 group-hover/team:text-sffl-red transition-colors">{homeTeam?.name}</h2>
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{homeTeam?.short_name}</span>
                                    </Link>
                                ) : (
                                    <>
                                        <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1">{homeTeam?.name}</h2>
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{homeTeam?.short_name}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Score / Time */}
                        <div className="flex flex-col items-center gap-1 md:gap-2 flex-shrink-0">
                            {isBye ? (
                                <div className="bg-white/10 backdrop-blur-sm px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-center border border-white/10">
                                    <div className="text-white font-black text-xl md:text-4xl tracking-tight">
                                        BYE
                                    </div>
                                    <div className="text-gray-400 text-[10px] md:text-xs mt-0.5 md:mt-1 font-semibold">AUTO QUALIFIED</div>
                                </div>
                            ) : isFinishedOrLive ? (
                                <div className="text-white font-black text-3xl md:text-7xl tracking-tighter leading-none tabular-nums flex items-center">
                                    {match.home_score ?? 0}
                                    <span className="text-gray-500 mx-1 md:mx-2 font-light">-</span>
                                    {match.away_score ?? 0}
                                </div>
                            ) : (
                                <div className="bg-white/10 backdrop-blur-sm px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-center border border-white/10">
                                    <div className="text-white font-black text-xl md:text-4xl tracking-tight">
                                        {formatMatchTime(match.start_time, match.date)}
                                    </div>
                                    <div className="text-gray-400 text-[10px] md:text-xs mt-0.5 md:mt-1 font-semibold">KICK OFF (WAT)</div>
                                </div>
                            )}
                            <span className="text-gray-500 text-[10px] md:text-xs font-bold tracking-widest uppercase">VS</span>
                        </div>

                        {/* Away */}
                        <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                            <div className="w-16 h-16 md:w-28 md:h-28 bg-white rounded-full overflow-hidden shadow-xl ring-4 ring-white/10 flex-shrink-0 flex items-center justify-center">
                                {isBye ? (
                                    <img 
                                        src="/images/default_football.png" 
                                        alt="BYE" 
                                        className="w-full h-full object-cover"
                                    />
                                ) : awayTeam?.logo ? (
                                    <LightboxImage 
                                        src={awayTeam.logo} 
                                        alt={awayTeam.name} 
                                        thumbnailClassName="w-full h-full"
                                        imgClassName="w-full h-full object-contain p-2 md:p-4"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-black text-gray-500">
                                        {awayTeam?.short_name?.slice(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                {isBye ? (
                                    <>
                                        <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1">BYE</h2>
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">AUTO QUALIFIED</span>
                                    </>
                                ) : awayTeam?.id ? (
                                    <Link to={`/teams/${awayTeam.id}`} className="block group/team">
                                        <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1 group-hover/team:text-sffl-red transition-colors">{awayTeam?.name}</h2>
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{awayTeam?.short_name}</span>
                                    </Link>
                                ) : (
                                    <>
                                        <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1">{awayTeam?.name}</h2>
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{awayTeam?.short_name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Action Links (Highlights / Tickets) ── */}
            {(match.highlights_url || match.ticket_url) && (
                <div className="flex flex-wrap gap-3">
                    {match.highlights_url && (
                        <a
                            href={match.highlights_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-3 bg-sffl-red text-white font-bold text-sm rounded-xl shadow-lg hover:bg-red-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            Watch Highlights
                        </a>
                    )}
                    {match.ticket_url && (
                        <a
                            href={match.ticket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 text-sffl-navy dark:text-white font-bold text-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
                        >
                            🎟️ Get Tickets
                        </a>
                    )}
                </div>
            )}

            {/* ── 5 Clean, Evenly Spaced Segmented Tabs ── */}
            {!isBye && (
                <div className="space-y-6">
                    {/* Segmented High-Contrast Tab Bar */}
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 mb-6 text-center">
                        {([
                            ['summary', 'Summary'],
                            ['rating', 'Team Sheets'],
                            ['plays', 'Play by Play'],
                            ['stats', 'Match Stats'],
                            ['discussions', 'Discussions'],
                        ] as const).map(([key, label]) => {
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(key);
                                        setSearchParams(prev => {
                                            const next = new URLSearchParams(prev);
                                            next.set('tab', key);
                                            return next;
                                        }, { replace: true });
                                    }}
                                    className={`py-2.5 px-3 rounded-xl text-center font-black text-xs md:text-sm uppercase tracking-tight transition-all duration-200 ${
                                        isActive
                                            ? 'bg-sffl-red text-white shadow-md shadow-sffl-red/20 scale-[1.01]'
                                            : 'text-gray-600 dark:text-gray-300 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-700/60'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab 0: Match Summary Overview */}
                    {activeTab === 'summary' && (
                        <MatchSummaryTab match={match} teamSheet={team_sheet} />
                    )}

                    {/* Tab 1: Team Sheets (Interactive Pitch & Detailed Roster) */}
                    {activeTab === 'rating' && (
                        <MatchTeamSheetTab match={match} teamSheet={team_sheet} mvpPlayerId={unifiedMvp?.playerId || null} />
                    )}

                    {/* Tab 2: Play-by-Play Timeline */}
                    {activeTab === 'plays' && (
                        <PlayByPlayTimeline matchId={match.id} isLive={match.status === 'LIVE'} showEmpty />
                    )}

                    {/* Tab 3: Match Stats Table (Full Player Box Score & Team Totals with Filters) */}
                    {activeTab === 'stats' && (
                        <PublicMatchStats matchId={match.id} />
                    )}

                    {/* Tab 4: Discussions */}
                    {activeTab === 'discussions' && (
                        <CommentSection entityType="match" entityId={match.id} />
                    )}
                </div>
            )}
        </div>
    );
};
