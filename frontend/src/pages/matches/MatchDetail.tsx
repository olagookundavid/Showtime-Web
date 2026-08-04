import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getMatchDetail, type TeamSheetPlayer } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { PlayByPlayTimeline } from '../../components/matches/PlayByPlayTimeline';
import { PublicMatchStats } from '../../components/matches/PublicMatchStats';

// Right-side value on the Player Rating tab. QB and undetermined "-" positions
// have no rating formula yet (dash); a rateable player with no rating didn't
// play / had no qualifying activity, shown as the base 5.0.
function ratingLabel(p: TeamSheetPlayer): string {
    if (p.position === '-') return '-';
    return p.rating != null ? p.rating.toFixed(1) : '5.0';
}

// Jersey number shown next to the position. 0 means no number assigned → dash.
function jerseyLabel(n: number): string {
    return n === 0 ? '–' : `#${n}`;
}

type RatingSort = 'default' | 'high' | 'low';

// Numeric value used to sort a player by rating, mirroring what ratingLabel
// shows: "-" has no number (sinks to the bottom); a rateable player with no
// rating sorts as the base 5.0.
function ratingSortValue(p: TeamSheetPlayer): number | null {
    if (p.position === '-') return null;
    return p.rating ?? 5.0;
}

// Returns a rating-sorted copy of the roster. 'default' keeps the incoming order
// (by jersey number). Non-rateable players always fall to the bottom.
function sortByRating(players: TeamSheetPlayer[], mode: RatingSort): TeamSheetPlayer[] {
    if (mode === 'default') return players;
    return [...players].sort((a, b) => {
        const av = ratingSortValue(a);
        const bv = ratingSortValue(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return mode === 'high' ? bv - av : av - bv;
    });
}

const RATING_SORT_LABEL: Record<RatingSort, string> = {
    default: '↕ By number',
    high: '▼ Highest rated',
    low: '▲ Lowest rated',
};

function formatTime(raw: string | null | undefined): string {
    if (!raw) return '--:--';
    if (raw.startsWith('0001')) return '--:--';
    const t = raw.includes('T') ? raw.split('T')[1] : raw;
    return t.slice(0, 5);
}

function formatDate(raw: string | null | undefined): string {
    if (!raw) return '';
    try {
        return new Date(raw).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
    } catch { return raw.split('T')[0]; }
}

export const MatchDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
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

    const [activeTab, setActiveTab] = useState<'rating' | 'plays' | 'stats'>('rating');
    const [ratingSort, setRatingSort] = useState<RatingSort>('default');
    const cycleRatingSort = () => setRatingSort(s => (s === 'default' ? 'high' : s === 'high' ? 'low' : 'default'));

    if (isLoading) return <Loader />;

    if (isError || !matchDetail) {
        return (
            <div className="text-center py-20 max-w-lg mx-auto px-4">
                <div className="text-6xl mb-6">🏈</div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white mb-3">Match Not Found</h1>
                <p className="text-gray-500 mb-8">This match could not be loaded. It may have been removed.</p>
                <Link to={backLink} className="px-6 py-3 bg-sffl-red text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                    ← Back to Matches
                </Link>
            </div>
        );
    }

    const { match, team_sheet } = matchDetail;

    if (!match?.id) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Match data unavailable.</p>
                <Link to={backLink} className="text-sffl-red hover:underline font-semibold mt-4 block">← Back</Link>
            </div>
        );
    }

    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const isFinishedOrLive = match.status === 'FINISHED' || match.status === 'LIVE';
    const homeSheet = team_sheet?.home_team ?? [];
    const awaySheet = team_sheet?.away_team ?? [];
    const hasTeamSheet = homeSheet.length > 0 || awaySheet.length > 0;
    const homeSheetSorted = sortByRating(homeSheet, ratingSort);
    const awaySheetSorted = sortByRating(awaySheet, ratingSort);

    const isBye = match.competition?.format === 'KNOCKOUT' &&
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
        <div className="space-y-4 md:space-y-8 pb-16">

            {/* Back nav */}
            <Link to={backLink} className="inline-flex items-center gap-1.5 text-sffl-red hover:underline font-bold text-xs uppercase tracking-wider">
                ← Back to Matches
            </Link>

            {/* Match Card Header */}
            <div className="bg-sffl-navy rounded-2xl shadow-2xl overflow-hidden border border-white/5 relative">
                <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url('/images/card_pattern.svg')` }} />
                <div className="relative p-6 md:p-12">
                    {/* Competition + date */}
                    <div className="text-center mb-8">
                        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${statusInfo.cls} text-white mb-3`}>
                            {statusInfo.label}
                        </span>
                        <p className="text-gray-300 text-sm font-semibold">
                            {match.competition?.name} {!isBye && ` • ${formatDate(match.date)}`}
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
                                        {formatTime(match.start_time)}
                                    </div>
                                    <div className="text-gray-400 text-[10px] md:text-xs mt-0.5 md:mt-1 font-semibold">KICK OFF</div>
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

            {/* ── 3 Clean, Evenly Spaced Text Tabs (Former Format) ── */}
            {!isBye && (
                <div className="space-y-6">
                    {/* Evenly Spaced Border-Bottom Tab Bar */}
                    <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-700 mb-6 text-center">
                        {([
                            ['rating', 'Player Rating'],
                            ['plays', 'Play by Play'],
                            ['stats', 'Match Stats'],
                        ] as const).map(([key, label]) => {
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setActiveTab(key)}
                                    className={`py-3 px-2 text-center -mb-px font-black text-xs md:text-sm uppercase tracking-tight transition-colors border-b-2 ${
                                        isActive
                                            ? 'text-sffl-red border-sffl-red'
                                            : 'text-gray-400 border-transparent hover:text-sffl-navy dark:hover:text-white'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab 1: Player Rating (Roster) */}
                    {activeTab === 'rating' && (
                        <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-3">
                                <h3 className="text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Player Rating</h3>
                                {hasTeamSheet && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Sort</span>
                                        <button
                                            type="button"
                                            onClick={cycleRatingSort}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-sffl-navy dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors tabular-nums"
                                        >
                                            {RATING_SORT_LABEL[ratingSort]}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!hasTeamSheet ? (
                                <div className="py-14 text-center">
                                    <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">No team sheet announced for this match yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700/50">
                                    {/* Home Sheet */}
                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            {homeTeam?.logo && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-100 dark:ring-gray-700">
                                                    <LightboxImage 
                                                        src={homeTeam.logo} 
                                                        alt={homeTeam.name} 
                                                        thumbnailClassName="w-full h-full"
                                                        imgClassName="w-full h-full object-cover" 
                                                    />
                                                </div>
                                            )}
                                            <h4 className="font-black text-base text-sffl-navy dark:text-white truncate min-w-0">{homeTeam?.name}</h4>
                                            <span className="text-xs bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                                                {homeSheet.length}
                                            </span>
                                        </div>
                                        {homeSheet.length === 0 ? (
                                            <p className="text-gray-400 dark:text-gray-600 italic text-sm text-center py-4">No roster data</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {homeSheetSorted.map(player => (
                                                    <Link
                                                        key={player.player_id}
                                                        to={`/players/${player.player_id}?match=${match.id}&comp=${match.competition?.id}&date=${match.date?.split('T')[0]}`}
                                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                                                    >
                                                        {player.image ? (
                                                            <LightboxImage 
                                                                src={player.image} 
                                                                alt={player.name} 
                                                                thumbnailClassName="w-10 h-10 rounded-full flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm" 
                                                                imgClassName="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-sffl-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-400 flex-shrink-0">
                                                                #{player.jersey_number}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-sffl-red transition-colors truncate">{player.name}</div>
                                                            <div className="text-xs text-gray-400 font-semibold">{jerseyLabel(player.jersey_number)} · {player.position}</div>
                                                        </div>
                                                        <span className="text-sm font-black text-sffl-navy dark:text-gray-200 flex-shrink-0 tabular-nums">{ratingLabel(player)}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Away Sheet */}
                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            {awayTeam?.logo && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-100 dark:ring-gray-700">
                                                    <LightboxImage 
                                                        src={awayTeam.logo} 
                                                        alt={awayTeam.name} 
                                                        thumbnailClassName="w-full h-full"
                                                        imgClassName="w-full h-full object-cover" 
                                                    />
                                                </div>
                                            )}
                                            <h4 className="font-black text-base text-sffl-navy dark:text-white truncate min-w-0">{awayTeam?.name}</h4>
                                            <span className="text-xs bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                                                {awaySheet.length}
                                            </span>
                                        </div>
                                        {awaySheet.length === 0 ? (
                                            <p className="text-gray-400 dark:text-gray-600 italic text-sm text-center py-4">No roster data</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {awaySheetSorted.map(player => (
                                                    <Link
                                                        key={player.player_id}
                                                        to={`/players/${player.player_id}?match=${match.id}&comp=${match.competition?.id}&date=${match.date?.split('T')[0]}`}
                                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                                                    >
                                                        {player.image ? (
                                                            <LightboxImage 
                                                                src={player.image} 
                                                                alt={player.name} 
                                                                thumbnailClassName="w-10 h-10 rounded-full flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm" 
                                                                imgClassName="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-sffl-navy/10 dark:bg-white/10 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-400 flex-shrink-0">
                                                                #{player.jersey_number}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-sffl-red transition-colors truncate">{player.name}</div>
                                                            <div className="text-xs text-gray-400 font-semibold">{jerseyLabel(player.jersey_number)} · {player.position}</div>
                                                        </div>
                                                        <span className="text-sm font-black text-sffl-navy dark:text-gray-200 flex-shrink-0 tabular-nums">{ratingLabel(player)}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Play-by-Play Timeline */}
                    {activeTab === 'plays' && (
                        <PlayByPlayTimeline matchId={match.id} isLive={match.status === 'LIVE'} showEmpty />
                    )}

                    {/* Tab 3: Match Stats Table (Full Player Box Score & Team Totals with Filters) */}
                    {activeTab === 'stats' && (
                        <PublicMatchStats matchId={match.id} />
                    )}
                </div>
            )}
        </div>
    );
};
