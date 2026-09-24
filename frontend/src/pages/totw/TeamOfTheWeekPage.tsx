import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTOTWArchive, getCompetitions, type TOTWListItem } from '../../services/api';
import { TeamOfTheWeekModule } from '../../components/totw/TeamOfTheWeekModule';
import {
    CalendarDaysIcon,
    TrophyIcon,
    ArrowTopRightOnSquareIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckIcon,
    ShareIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export const TeamOfTheWeekPage: React.FC = () => {
    const { id: routeTotwId } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const pitchRef = useRef<HTMLDivElement>(null);

    const [selectedCompId, setSelectedCompId] = useState<string>('ALL');
    const [copied, setCopied] = useState<boolean>(false);

    // Fetch all competitions for filtering
    const { data: compData } = useQuery({
        queryKey: ['competitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions = compData?.data || [];

    // Fetch archive editions (pass competitionId if specific one selected)
    const effectiveCompId = selectedCompId === 'ALL' ? undefined : selectedCompId;
    const { data: archive = [], isLoading: isArchiveLoading } = useQuery<TOTWListItem[]>({
        queryKey: ['totwArchive', effectiveCompId],
        queryFn: () => getTOTWArchive(effectiveCompId),
    });

    // Determine current active edition ID
    const activeTotwId = useMemo(() => {
        if (routeTotwId) return routeTotwId;
        if (archive.length > 0) return archive[0].id;
        return undefined;
    }, [routeTotwId, archive]);

    // Current edition index in archive list
    const currentIndex = useMemo(() => {
        if (!activeTotwId) return -1;
        return archive.findIndex((item) => item.id === activeTotwId);
    }, [activeTotwId, archive]);

    const activeEdition = currentIndex >= 0 ? archive[currentIndex] : null;

    const handleSelectEdition = (totwId: string) => {
        navigate(`/totw/${totwId}`);
        pitchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handlePrevEdition = () => {
        if (currentIndex < archive.length - 1) {
            const prevItem = archive[currentIndex + 1];
            handleSelectEdition(prevItem.id);
        }
    };

    const handleNextEdition = () => {
        if (currentIndex > 0) {
            const nextItem = archive[currentIndex - 1];
            handleSelectEdition(nextItem.id);
        }
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success('Link copied to clipboard!');
                setTimeout(() => setCopied(false), 2500);
            } catch {
                toast.error('Failed to copy link');
            }
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-8 md:space-y-12 animate-fade-in">
            {/* ── Page Header Banner (Showtime Signature Design System) ─────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-6 border border-white/10">
                <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sffl-red/20 border border-sffl-red/40 text-sffl-red text-xs font-black uppercase tracking-wider">
                        <SparklesIcon className="w-3.5 h-3.5" />
                        <span>Showtime Official Selections</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white">
                        TEAM OF THE WEEK
                    </h1>
                    <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                        Honoring the premier offensive and defensive playmakers across official Showtime matchdays. Browse current and historical Starting XIV lineups, player box scores, and performance ratings.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all border border-white/20 shadow-sm"
                    >
                        {copied ? (
                            <>
                                <CheckIcon className="w-4 h-4 text-emerald-400" />
                                <span>Copied!</span>
                            </>
                        ) : (
                            <>
                                <ShareIcon className="w-4 h-4" />
                                <span>Share Edition</span>
                            </>
                        )}
                    </button>
                    <Link
                        to="/matches"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md"
                    >
                        <TrophyIcon className="w-4 h-4" />
                        <span>Match Center</span>
                    </Link>
                </div>
            </div>

            {/* ── Active Edition Spotlight & Pitch ──────────────────────────── */}
            <div ref={pitchRef} className="space-y-4">
                {/* Gameweek Stepper Controls */}
                {archive.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 md:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-sffl-red animate-pulse"></span>
                            <div className="text-xs md:text-sm font-bold text-gray-900 dark:text-white">
                                {activeEdition?.week_title || 'Active Edition'}
                                {activeEdition?.headline && (
                                    <span className="hidden sm:inline text-gray-500 dark:text-gray-400 font-normal">
                                        {' '}— {activeEdition.headline}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePrevEdition}
                                disabled={currentIndex >= archive.length - 1}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                title="Previous Week"
                            >
                                <ChevronLeftIcon className="w-3.5 h-3.5" />
                                <span>Older</span>
                            </button>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                                {currentIndex >= 0 ? `${currentIndex + 1} of ${archive.length}` : ''}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextEdition}
                                disabled={currentIndex <= 0}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                title="Next Week"
                            >
                                <span>Newer</span>
                                <ChevronRightIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Team of the Week Pitch Module */}
                <TeamOfTheWeekModule
                    totwId={activeTotwId}
                    competitionId={effectiveCompId}
                    showArchiveLink={false}
                    onSelectEdition={handleSelectEdition}
                />
            </div>

            {/* ── All Editions Archive Section ──────────────────────────────── */}
            <section className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-2xl md:text-3xl font-black italic tracking-tight text-sffl-navy dark:text-white">
                                ALL EDITIONS ARCHIVE
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sffl-red/10 text-sffl-red border border-sffl-red/20">
                                {archive.length}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            Select any past gameweek to inspect historical Starting XIV lineups, player box scores, and MVP ratings.
                        </p>
                    </div>

                    {/* Competition Filter Pills */}
                    {competitions.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-thin">
                            <button
                                type="button"
                                onClick={() => setSelectedCompId('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                    selectedCompId === 'ALL'
                                        ? 'bg-sffl-navy text-white shadow-sm'
                                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                All Competitions
                            </button>
                            {competitions.map((comp) => (
                                <button
                                    key={comp.id}
                                    type="button"
                                    onClick={() => setSelectedCompId(comp.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                        selectedCompId === comp.id
                                            ? 'bg-sffl-navy text-white shadow-sm'
                                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {comp.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Archive Cards Grid */}
                {isArchiveLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="h-44 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse p-6"
                            />
                        ))}
                    </div>
                ) : archive.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
                        <TrophyIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">No Editions Published Yet</p>
                        <p className="text-sm mt-1">Official Team of the Week selections will appear here following gamedays.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {archive.map((edition) => {
                            const isSelected = edition.id === activeTotwId;
                            return (
                                <article
                                    key={edition.id}
                                    onClick={() => handleSelectEdition(edition.id)}
                                    className={`group relative flex flex-col justify-between p-5 md:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                                        isSelected
                                            ? 'bg-gradient-to-br from-white to-red-50/40 dark:from-gray-800 dark:to-red-950/20 border-sffl-red ring-2 ring-sffl-red shadow-lg'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sffl-red/60 hover:shadow-md'
                                    }`}
                                >
                                    <div>
                                        {/* Top Meta Strip */}
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                {edition.competition_name || 'Showtime League'}
                                            </span>
                                            {edition.published_at && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                    <CalendarDaysIcon className="w-3.5 h-3.5" />
                                                    {formatDate(edition.published_at)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title & Headline */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xl font-black italic tracking-tight text-sffl-navy dark:text-white group-hover:text-sffl-red transition-colors">
                                                    {edition.week_title}
                                                </h3>
                                                {isSelected && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-sffl-red text-white shadow-xs">
                                                        Active View
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1">
                                                {edition.headline}
                                            </p>
                                            {edition.sub_headline && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                    {edition.sub_headline}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                            14 Starting Players
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-sffl-red group-hover:translate-x-0.5 transition-transform">
                                            <span>{isSelected ? 'Viewing' : 'Inspect Lineup'}</span>
                                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};
export default TeamOfTheWeekPage;
