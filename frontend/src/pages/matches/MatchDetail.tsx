import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getMatchDetail } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';

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

    const { data: matchDetail, isLoading, isError } = useQuery({
        queryKey: ['publicMatchDetail', id],
        queryFn: () => getMatchDetail(id!),
        enabled: !!id,
        retry: 1,
    });

    if (isLoading) return <Loader />;

    if (isError || !matchDetail) {
        return (
            <div className="text-center py-20 max-w-lg mx-auto px-4">
                <div className="text-6xl mb-6">🏈</div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white mb-3">Match Not Found</h1>
                <p className="text-gray-500 mb-8">This match could not be loaded. It may have been removed.</p>
                <Link to="/matches" className="px-6 py-3 bg-sffl-red text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
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
                <Link to="/matches" className="text-sffl-red hover:underline font-semibold mt-4 block">← Back</Link>
            </div>
        );
    }

    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const isFinishedOrLive = match.status === 'FINISHED' || match.status === 'LIVE';
    const homeSheet = team_sheet?.home_team ?? [];
    const awaySheet = team_sheet?.away_team ?? [];
    const hasTeamSheet = homeSheet.length > 0 || awaySheet.length > 0;

    const statusConfig = {
        LIVE:      { label: 'LIVE', cls: 'bg-red-500 animate-pulse' },
        FINISHED:  { label: 'FULL TIME', cls: 'bg-emerald-600' },
        SCHEDULED: { label: 'UPCOMING', cls: 'bg-blue-500' },
        POSTPONED: { label: 'POSTPONED', cls: 'bg-amber-500' },
    } as const;
    const statusInfo = statusConfig[match.status as keyof typeof statusConfig] ?? { label: match.status, cls: 'bg-gray-500' };

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8 pb-16">

            {/* Back nav */}
            <Link to="/matches" className="inline-flex items-center gap-1.5 text-sffl-red hover:underline font-bold text-xs uppercase tracking-wider">
                ← Back to Matches
            </Link>

            {/* ── Scoreboard ── */}
            <div className="relative bg-sffl-navy rounded-3xl overflow-hidden shadow-2xl">
                {/* Background texture */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.06)_0%,_transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(206,17,38,0.15)_0%,_transparent_60%)]" />

                <div className="relative z-10 p-6 md:p-10">
                    {/* Competition + date */}
                    <div className="text-center mb-8">
                        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${statusInfo.cls} text-white mb-3`}>
                            {statusInfo.label}
                        </span>
                        <p className="text-gray-300 text-sm font-semibold">
                            {match.competition?.name}  •  {formatDate(match.date)}
                        </p>
                        {match.venue && (
                            <p className="text-gray-500 text-xs mt-1">📍 {match.venue}</p>
                        )}
                    </div>

                    {/* Teams + Score */}
                    <div className="flex items-center justify-between gap-2 md:gap-8">
                        {/* Home */}
                        <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                            <div className="w-16 h-16 md:w-28 md:h-28 bg-white rounded-full overflow-hidden shadow-xl ring-4 ring-white/10 flex-shrink-0">
                                {homeTeam?.logo ? (
                                    <LightboxImage 
                                        src={homeTeam.logo} 
                                        alt={homeTeam.name} 
                                        thumbnailClassName="w-full h-full"
                                        imgClassName="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-black text-gray-500">
                                        {homeTeam?.short_name?.slice(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1">{homeTeam?.name}</h2>
                                <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{homeTeam?.short_name}</span>
                            </div>
                        </div>

                        {/* Score / Time */}
                        <div className="flex flex-col items-center gap-1 md:gap-2 flex-shrink-0">
                            {isFinishedOrLive ? (
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
                            <div className="w-16 h-16 md:w-28 md:h-28 bg-white rounded-full overflow-hidden shadow-xl ring-4 ring-white/10 flex-shrink-0">
                                {awayTeam?.logo ? (
                                    <LightboxImage 
                                        src={awayTeam.logo} 
                                        alt={awayTeam.name} 
                                        thumbnailClassName="w-full h-full"
                                        imgClassName="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-black text-gray-500">
                                        {awayTeam?.short_name?.slice(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                <h2 className="text-white font-black text-sm md:text-2xl leading-tight truncate px-1">{awayTeam?.name}</h2>
                                <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{awayTeam?.short_name}</span>
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

            {/* ── Team Sheets ── */}
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                    <h3 className="text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Team Sheets</h3>
                    {hasTeamSheet && (
                        <span className="text-xs text-gray-400 font-semibold">{homeSheet.length + awaySheet.length} players listed</span>
                    )}
                </div>

                {!hasTeamSheet ? (
                    <div className="py-14 text-center">
                        <div className="text-4xl mb-4">📋</div>
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
                                <h4 className="font-black text-base text-sffl-navy dark:text-white truncate">{homeTeam?.name}</h4>
                                <span className="ml-auto text-xs bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                                    {homeSheet.length}
                                </span>
                            </div>
                            {homeSheet.length === 0 ? (
                                <p className="text-gray-400 dark:text-gray-600 italic text-sm text-center py-4">No roster data</p>
                            ) : (
                                <div className="space-y-1">
                                    {homeSheet.map(player => (
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
                                                <div className="text-xs text-gray-400 font-semibold">{player.position}</div>
                                            </div>
                                            <span className="text-sm font-black text-gray-300 dark:text-gray-600 flex-shrink-0">#{player.jersey_number}</span>
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
                                <h4 className="font-black text-base text-sffl-navy dark:text-white truncate">{awayTeam?.name}</h4>
                                <span className="ml-auto text-xs bg-sffl-navy/10 dark:bg-white/10 text-sffl-navy dark:text-gray-300 font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                                    {awaySheet.length}
                                </span>
                            </div>
                            {awaySheet.length === 0 ? (
                                <p className="text-gray-400 dark:text-gray-600 italic text-sm text-center py-4">No roster data</p>
                            ) : (
                                <div className="space-y-1">
                                    {awaySheet.map(player => (
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
                                                <div className="text-xs text-gray-400 font-semibold">{player.position}</div>
                                            </div>
                                            <span className="text-sm font-black text-gray-300 dark:text-gray-600 flex-shrink-0">#{player.jersey_number}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
