import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getCompetitions,
    getStatDates,
    getTOTW,
    getLatestTOTW,
    type Competition
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { LightboxImage } from '../../components/ui';
import { StarIcon, CalendarIcon, TrophyIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Link, useSearchParams } from 'react-router-dom';

const GROUP_CONFIG = [
    { id: 'QB', label: 'Quarterback', color: 'blue' },
    { id: 'WR', label: 'Offense (WR/RB)', color: 'green' },
    { id: 'DEF', label: 'Defense', color: 'red' },
] as const;

export const TOTWPage = () => {
    const [searchParams] = useSearchParams();
    const urlComp = searchParams.get('comp');
    const urlDate = searchParams.get('date');

    const [selectedComp, setSelectedComp] = useState<string>(urlComp || '');
    const [selectedDate, setSelectedDate] = useState<string>(urlDate || '');

    // Queries
    const { data: compData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompsList'],
        queryFn: () => getCompetitions(1, 100),
    });
    const comps: Competition[] = compData?.data || [];

    const { data: datesData, isLoading: loadingDates } = useQuery({
        queryKey: ['statDates', selectedComp],
        queryFn: () => getStatDates(selectedComp),
        enabled: !!selectedComp,
    });
    const statDates = datesData || [];

    const { data: totwEntries, isLoading: loadingTOTW } = useQuery({
        queryKey: ['publicTOTW', selectedComp, selectedDate],
        queryFn: () => getTOTW(selectedComp, selectedDate),
        enabled: !!selectedComp && !!selectedDate,
    });

    // 1. Fetch Latest TOTW to determine defaults
    const { data: latestInit } = useQuery({
        queryKey: ['latestTOTWInit'],
        queryFn: () => getLatestTOTW(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // 2. Auto-select latest competition and date from the overall latest TOTW
    useEffect(() => {
        if (latestInit?.date && !selectedComp && !selectedDate) {
            if (latestInit.data.length > 0) {
                setSelectedComp(latestInit.data[0].competition_id);
                setSelectedDate(latestInit.date);
            }
        }
    }, [latestInit, selectedComp, selectedDate]);

    // Auto-select latest competition and date
    useEffect(() => {
        if (comps.length > 0 && !selectedComp) {
            setSelectedComp(comps[0].id);
        }
    }, [comps, selectedComp]);

    useEffect(() => {
        if (statDates.length > 0 && !selectedDate) {
            setSelectedDate(statDates[0]);
        }
    }, [statDates, selectedDate]);

    const isLoading = loadingComps || loadingDates || loadingTOTW;

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 min-h-screen">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-sffl-navy p-8 md:p-12 rounded-[2rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border-b-8 border-sffl-red">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-sffl-red/10 rounded-full blur-3xl"></div>
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase leading-none">
                        Team of <span className="text-sffl-red">the Week</span>
                    </h1>
                    <p className="text-gray-400 mt-3 text-lg font-bold flex items-center justify-center md:justify-start gap-2">
                        <StarIcon className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        Celebrating exceptional performances across the league
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto relative z-10">
                    <div className="flex-1 sm:w-64">
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest pl-1">Competition</label>
                        <div className="relative">
                            <TrophyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={selectedComp}
                                onChange={e => setSelectedComp(e.target.value)}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white pl-10 pr-4 py-3 rounded-2xl font-bold text-sm transition-all outline-none focus:ring-2 focus:ring-sffl-red cursor-pointer"
                            >
                                {comps.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 sm:w-48">
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest pl-1">Match Day</label>
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white pl-10 pr-4 py-3 rounded-2xl font-bold text-sm transition-all outline-none focus:ring-2 focus:ring-sffl-red cursor-pointer disabled:opacity-50"
                                disabled={statDates.length === 0}
                            >
                                {statDates.length === 0 && <option value="">No Data</option>}
                                {statDates.map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="py-20"><Loader /></div>
            ) : totwEntries && totwEntries.length > 0 ? (
                <div className="grid grid-cols-1 gap-12">
                    {GROUP_CONFIG.map(group => {
                        const entries = totwEntries.filter(e => e.position_group === group.id);
                        if (entries.length === 0) return null;

                        return (
                            <section key={group.id} className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <h2 className={`text-2xl font-black italic uppercase tracking-tight text-${group.color}-600 bg-${group.color}-50 dark:bg-${group.color}-900/20 px-6 py-2 rounded-2xl border-l-4 border-${group.color}-600`}>
                                        {group.label}
                                    </h2>
                                    <div className="flex-1 h-[2px] bg-gray-100 dark:bg-gray-800"></div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {entries.map(entry => (
                                        <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-xl border border-gray-100 dark:border-gray-700 hover:scale-[1.01] transition-transform flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                                            {/* Player Info Card */}
                                            <div className="flex items-center gap-4 md:gap-6 min-w-0">
                                                <div className="relative shrink-0">
                                                    <LightboxImage
                                                        src={entry.player?.image || ''}
                                                        alt={entry.player?.name || ''}
                                                        thumbnailClassName="w-16 h-16 md:w-24 md:h-24 rounded-3xl object-cover shadow-lg border-2 border-white dark:border-gray-700"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-sffl-red text-white text-[10px] md:text-xs font-black p-1.5 md:p-2 rounded-xl shadow-lg border-2 border-white dark:border-gray-800 min-w-[2rem] md:min-w-[2.5rem] text-center">
                                                        #{entry.player?.jersey_number}
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-lg md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tighter leading-tight truncate">{entry.player?.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1 md:mt-2">
                                                        <LightboxImage src={entry.player?.team?.logo || ''} alt={entry.player?.team?.name || ''} thumbnailClassName="w-4 h-4 md:w-6 md:h-6 object-contain" />
                                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest truncate">{entry.player?.team?.short_name || entry.player?.team?.name}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Simplified CTA */}
                                            <Link
                                                to={`/stats?comp=${selectedComp}&date=${selectedDate}&player_id=${entry.player_id}&search=${encodeURIComponent(entry.player?.name || '')}`}
                                                className="w-full md:w-auto px-6 py-3 bg-sffl-navy text-white text-[10px] md:text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-sffl-navy-light transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
                                            >
                                                View Stats
                                                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="py-32 text-center bg-gray-50 dark:bg-gray-800/50 rounded-[3rem] border-4 border-dashed border-gray-100 dark:border-gray-700">
                    <StarIcon className="w-20 h-20 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
                    <p className="text-xl font-black uppercase text-gray-400 italic">No Team of the Week entry for this match day.</p>
                    <Link to={`/stats?comp=${selectedComp}&date=${selectedDate}`} className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-sffl-navy text-white font-black italic uppercase rounded-2xl shadow-xl hover:bg-sffl-navy-light transition-all">
                        View All Stats <ArrowRightIcon className="w-5 h-5" />
                    </Link>
                </div>
            )}
        </div>
    );
};
