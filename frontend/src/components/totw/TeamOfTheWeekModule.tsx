import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLatestTOTW, getTOTWArchive, getTOTWById, type TeamOfTheWeek, type TOTWPlayer } from '../../services/api';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface TeamOfTheWeekModuleProps {
    competitionId?: string;
    className?: string;
    totwId?: string;
    showArchiveLink?: boolean;
    onSelectEdition?: (id: string) => void;
}

export const TeamOfTheWeekModule: React.FC<TeamOfTheWeekModuleProps> = ({
    competitionId,
    className = '',
    totwId,
    showArchiveLink = false,
    onSelectEdition,
}) => {
    const [selectedTotwId, setSelectedTotwId] = useState<string | null>(totwId || null);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    // Keep internal selected ID in sync with the external totwId prop, including
    // when it becomes undefined (e.g. the parent's filter has no active edition)
    useEffect(() => {
        setSelectedTotwId(totwId || null);
    }, [totwId]);

    // Fetch archive editions for dropdown selector
    const { data: archive = [] } = useQuery({
        queryKey: ['totwArchive', competitionId],
        queryFn: () => getTOTWArchive(competitionId),
    });

    // Fetch latest or selected TOTW
    const { data: totw, isLoading, error } = useQuery<TeamOfTheWeek>({
        queryKey: ['totw', selectedTotwId, competitionId],
        queryFn: () => {
            if (selectedTotwId) {
                return getTOTWById(selectedTotwId);
            }
            return getLatestTOTW(competitionId);
        },
    });

    // Reset selected index when TOTW changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [totw?.id]);

    if (isLoading) {
        return (
            <div className={`w-full max-w-[980px] mx-auto rounded-3xl bg-sffl-navy/95 border border-white/10 p-12 text-center text-white ${className}`}>
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-sffl-red border-t-transparent mb-4"></div>
                <p className="text-sm font-bold uppercase tracking-wider text-gray-300">Loading Team of the Week...</p>
            </div>
        );
    }

    if (error || !totw || !totw.players || totw.players.length === 0) {
        return null; // Gracefully hide when no TOTW has been published yet
    }

    const players: TOTWPlayer[] = totw.players;
    const activePlayer: TOTWPlayer = players[selectedIndex] || players[0];
    const isDefensive = activePlayer.unit === 'Defence';

    const handlePrev = () => {
        setSelectedIndex((prev) => (prev - 1 + players.length) % players.length);
    };

    const handleNext = () => {
        setSelectedIndex((prev) => (prev + 1) % players.length);
    };

    return (
        <section className={`w-full max-w-[980px] mx-auto text-white ${className}`} aria-label="Showtime Team of the Week">
            <div className="overflow-hidden rounded-2xl md:rounded-3xl bg-[#07182E] border border-white/15 shadow-2xl">
                {/* ── Top Header ───────────────────────────────────────────── */}
                <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 md:px-6 md:py-4 bg-gradient-to-r from-[#102A4E] to-[#07162B] border-b border-white/10">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <img
                            src="/images/branding/showtime-logo.png"
                            alt="Showtime Flag Football"
                            className="w-10 h-10 md:w-12 md:h-12 object-contain shrink-0"
                        />
                        <div className="min-w-0">
                            <div className="text-[10px] md:text-xs font-black uppercase tracking-wider text-[#91A7C1]">
                                {totw.headline || `${totw.competition?.name || 'Showtime League'} · ${totw.week_title}`}
                            </div>
                            <h2 className="text-lg md:text-2xl font-black italic tracking-tight text-white leading-none mt-0.5">
                                TEAM OF THE WEEK
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {showArchiveLink && (
                            <Link
                                to="/totw"
                                className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 transition-all hover:scale-[1.02] shadow-sm shrink-0"
                            >
                                <span>Browse Archive</span>
                                <ChevronRightIcon className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        {archive.length > 1 && (
                            <select
                                value={totw.id}
                                onChange={(e) => {
                                    setSelectedTotwId(e.target.value);
                                    onSelectEdition?.(e.target.value);
                                }}
                                className="bg-[#112D4E] text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:border-sffl-red"
                                aria-label="Select Gameday"
                            >
                                {archive.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.week_title} {item.headline ? `— ${item.headline}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                        <span className="bg-sffl-red text-white text-[11px] md:text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-md shadow-sm">
                            {totw.week_title || 'Week'}
                        </span>
                    </div>
                </header>

                {/* ── Section Subheader & Legend ───────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-3.5 bg-[#091D36]/80 border-b border-white/5 text-xs">
                    <div>
                        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-[#91A7C1]">
                            Starting XIV
                        </div>
                        <div className="text-xs md:text-sm font-bold text-white">
                            {totw.sub_headline || 'Offence & defence lineup'}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] md:text-xs font-bold text-gray-300">
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-full bg-sffl-red inline-block"></i>
                            Offence 7
                        </span>
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-full bg-[#76BAFF] inline-block"></i>
                            Defence 7
                        </span>
                    </div>
                </div>

                {/* ── Football Pitch Formation ──────────────────────────────── */}
                <div className="p-2 md:p-5 bg-[#051325]">
                    <div
                        className="relative w-full h-[580px] md:h-[650px] overflow-hidden rounded-xl md:rounded-2xl border-2 border-emerald-400/25 shadow-inner select-none"
                        style={{
                            background: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(20% - 1px), rgba(229, 243, 220, 0.12) calc(20% - 1px), rgba(229, 243, 220, 0.12) 20%),
                                         repeating-linear-gradient(to bottom, #174C3A 0, #174C3A 20%, #134332 20%, #134332 40%)`,
                            boxShadow: 'inset 0 0 80px rgba(0, 20, 12, 0.75)',
                        }}
                        role="group"
                        aria-label="Team of the Week field formation"
                    >
                        {/* Sidelines & Markers */}
                        <div className="absolute top-[12%] bottom-[12%] left-[4%] w-px bg-white/20"></div>
                        <div className="absolute top-[12%] bottom-[12%] right-[4%] w-px bg-white/20"></div>
                        <div className="absolute top-[12%] left-[4%] right-[4%] h-px bg-white/25"></div>
                        <div className="absolute bottom-[12%] left-[4%] right-[4%] h-px bg-white/25"></div>

                        {/* Top Endzone */}
                        <div className="absolute top-0 left-0 right-0 h-[12%] flex items-center justify-center text-white/20 bg-[#0C2D28]/70 border-b border-white/20 font-black italic tracking-[0.25em] text-xl md:text-3xl pointer-events-none">
                            SHOWTIME
                        </div>

                        {/* Bottom Endzone */}
                        <div className="absolute bottom-0 left-0 right-0 h-[12%] flex items-center justify-center text-white/20 bg-[#0C2D28]/70 border-t border-white/20 font-black italic tracking-[0.25em] text-xl md:text-3xl pointer-events-none">
                            TEAM OF THE WEEK
                        </div>

                        {/* Line of Scrimmage */}
                        <div className="absolute top-1/2 left-[3%] right-[3%] border-t-2 border-dashed border-[#F8F1DD]/60 z-10"></div>
                        <span className="absolute top-1/2 right-[5%] -translate-y-1/2 z-20 px-2 py-0.5 rounded bg-[#F7F2E6] text-[#12392F] text-[8px] md:text-[9px] font-black tracking-wider uppercase shadow-xs">
                            Line of Scrimmage
                        </span>

                        {/* Unit Labels */}
                        <span className="absolute top-[13.5%] left-[5.5%] z-10 text-[#DCEADE]/70 text-[9px] md:text-[10px] font-black tracking-widest uppercase">
                            DEFENCE
                        </span>
                        <span className="absolute top-[52%] left-[5.5%] z-10 text-[#DCEADE]/70 text-[9px] md:text-[10px] font-black tracking-widest uppercase">
                            OFFENCE
                        </span>

                        {/* 14 Player Pins */}
                        {players.map((p, idx) => {
                            const isSelected = idx === selectedIndex;
                            const isPlayerDef = p.unit === 'Defence';
                            const hasImage = Boolean(p.player?.image);
                            // Ensure symmetrical equal spacing (32% and 68%) for backfield positions matching S1/S2
                            let posX = p.coord_x || '50%';
                            if ((p.slot_code === 'QB' || p.slot_code === 'OFF2') && (posX === '50%' || !p.coord_x)) {
                                posX = '68%';
                            } else if ((p.slot_code === 'FQB' || p.slot_code === 'OFF1') && !p.coord_x) {
                                posX = '32%';
                            }

                            return (
                                <button
                                    key={p.id || p.slot_code || idx}
                                    type="button"
                                    onClick={() => setSelectedIndex(idx)}
                                    style={{
                                        left: posX,
                                        top: p.coord_y || '50%',
                                    }}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 w-16 md:w-24 p-1 rounded-xl text-center transition-all duration-200 focus:outline-none group cursor-pointer ${
                                        isSelected ? 'scale-110 z-40' : 'hover:scale-105 opacity-90 hover:opacity-100'
                                    }`}
                                    aria-pressed={isSelected}
                                    aria-label={`${p.position} ${p.player?.name || 'Player'}`}
                                >
                                    {/* Avatar circle */}
                                    <div
                                        className={`relative w-10 h-10 md:w-12 md:h-12 mx-auto rounded-full border-2 overflow-hidden shadow-lg transition-all duration-200 ${
                                            isSelected
                                                ? 'border-white ring-4 ring-[#F4CA67] ring-offset-2 ring-offset-black/50 shadow-amber-400/40'
                                                : isPlayerDef
                                                ? 'border-blue-300/80 bg-gradient-to-br from-[#98CDFD] to-[#35699E]'
                                                : 'border-red-300/80 bg-gradient-to-br from-[#F46756] to-[#B82C34]'
                                        }`}
                                    >
                                        {hasImage ? (
                                            <img
                                                src={p.player?.image}
                                                alt={p.player?.name || 'Player'}
                                                className="w-full h-full object-cover object-top"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-black text-white/90">
                                                {p.player?.jersey_number ? `#${p.player.jersey_number}` : p.position}
                                            </div>
                                        )}
                                    </div>

                                    {/* Position pill */}
                                    <span
                                        className={`inline-block px-1.5 py-0.5 mt-1 rounded text-[8px] md:text-[9px] font-black uppercase leading-tight shadow-xs ${
                                            isPlayerDef ? 'bg-[#C5E1FF] text-[#102844]' : 'bg-[#FFF8E9] text-[#102844]'
                                        }`}
                                    >
                                        {p.slot_code || p.position}
                                    </span>

                                    {/* Player Name */}
                                    <span className="block mt-0.5 text-[9px] md:text-[10px] font-black text-white truncate drop-shadow-md leading-tight group-hover:text-yellow-300">
                                        {p.player?.name || 'Player'}
                                    </span>

                                    {/* Team short code */}
                                    {p.player?.team?.short_name && (
                                        <span className="hidden md:block text-[8px] font-bold text-gray-300/80 uppercase">
                                            {p.player.team.short_name}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Carousel Profile Card ─────────────────────────────────── */}
                <div className="bg-[#091D36] p-4 md:p-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3 text-xs">
                        <div>
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-[#91A7C0]">
                                Player spotlight
                            </span>
                            <div className="text-sm md:text-base font-black text-white">
                                Meet the Starting XIV
                            </div>
                        </div>
                        <div className="text-xs font-black text-[#91A7C0]">
                            {selectedIndex + 1} of {players.length}
                        </div>
                    </div>

                    <div className="grid grid-cols-[36px_1fr_36px] md:grid-cols-[48px_1fr_48px] items-center gap-2 md:gap-4">
                        {/* Prev Button */}
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="w-9 h-12 md:w-12 md:h-16 rounded-xl bg-[#112D4E] hover:bg-sffl-red text-white flex items-center justify-center border border-white/20 transition-all active:scale-95 shadow-md cursor-pointer"
                            aria-label="Previous player"
                        >
                            <ChevronLeftIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>

                        {/* Active Player Card */}
                        <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#123156] to-[#0C2441] border border-white/15 shadow-xl grid grid-cols-1 sm:grid-cols-[130px_1fr] md:grid-cols-[170px_1fr] min-h-[170px]">
                            {/* Visual Avatar column */}
                            <div
                                className={`relative flex items-center justify-center p-4 ${
                                    isDefensive
                                        ? 'bg-radial from-[#315C89] via-[#183C63] to-[#102B4B]'
                                        : 'bg-radial from-[#9D4646] via-[#6E3038] to-[#3D2634]'
                                }`}
                            >
                                {/* Rating Badge */}
                                <div className="absolute top-2 left-2 md:top-3 md:left-3 w-9 h-9 md:w-11 md:h-11 rounded-full bg-[#F4CA67] text-[#172237] font-black text-xs md:text-sm flex items-center justify-center shadow-lg border border-yellow-200">
                                    {activePlayer.rating ? Number(activePlayer.rating).toFixed(1) : '8.5'}
                                </div>

                                {/* Avatar */}
                                <div className="w-20 h-24 md:w-28 md:h-34 rounded-2xl overflow-hidden bg-slate-800 border-2 border-white/20 shadow-2xl flex items-center justify-center">
                                    {activePlayer.player?.image ? (
                                        <img
                                            src={activePlayer.player.image}
                                            alt={activePlayer.player.name}
                                            className="w-full h-full object-cover object-top"
                                        />
                                    ) : (
                                        <div className="text-3xl font-black text-white/50">
                                            {activePlayer.position}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details column */}
                            <div className="p-4 md:p-5 flex flex-col justify-center min-w-0">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2.5 py-0.5 rounded text-[10px] md:text-xs font-black uppercase tracking-wider ${
                                            isDefensive ? 'bg-[#76BAFF] text-[#09223D]' : 'bg-sffl-red text-white'
                                        }`}
                                    >
                                        {activePlayer.slot_code || activePlayer.position}
                                    </span>
                                    {activePlayer.player?.position && (
                                        <span className="text-[10px] md:text-xs font-bold text-gray-300">
                                            • {activePlayer.player.position}
                                        </span>
                                    )}
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-[#A8BBD1]">
                                        {activePlayer.unit}
                                    </span>
                                </div>

                                <h3 className="text-lg md:text-2xl font-black text-white mt-1 truncate">
                                    {activePlayer.player?.id ? (
                                        <Link
                                            to={`/players/${activePlayer.player.id}`}
                                            className="hover:text-yellow-300 transition-colors"
                                        >
                                            {activePlayer.player.name}
                                        </Link>
                                    ) : (
                                        activePlayer.player?.name || 'Selected Player'
                                    )}
                                </h3>

                                <div className="text-xs md:text-sm font-semibold text-gray-300">
                                    {activePlayer.player?.team?.name || 'Showtime League'}
                                </div>

                                {/* 3 Key Stats */}
                                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
                                    <div className="bg-[#06182D]/70 p-2 md:p-2.5 rounded-lg border border-white/10 text-center">
                                        <div className="text-sm md:text-lg font-black text-white leading-tight">
                                            {activePlayer.stat1_value || '—'}
                                        </div>
                                        <div className="text-[8px] md:text-[9px] font-black uppercase text-[#8FA4BC] tracking-wider mt-0.5 truncate">
                                            {activePlayer.stat1_label || 'Stat 1'}
                                        </div>
                                    </div>
                                    <div className="bg-[#06182D]/70 p-2 md:p-2.5 rounded-lg border border-white/10 text-center">
                                        <div className="text-sm md:text-lg font-black text-white leading-tight">
                                            {activePlayer.stat2_value || '—'}
                                        </div>
                                        <div className="text-[8px] md:text-[9px] font-black uppercase text-[#8FA4BC] tracking-wider mt-0.5 truncate">
                                            {activePlayer.stat2_label || 'Stat 2'}
                                        </div>
                                    </div>
                                    <div className="bg-[#06182D]/70 p-2 md:p-2.5 rounded-lg border border-white/10 text-center">
                                        <div className="text-sm md:text-lg font-black text-white leading-tight">
                                            {activePlayer.stat3_value || '—'}
                                        </div>
                                        <div className="text-[8px] md:text-[9px] font-black uppercase text-[#8FA4BC] tracking-wider mt-0.5 truncate">
                                            {activePlayer.stat3_label || 'Stat 3'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>

                        {/* Next Button */}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="w-9 h-12 md:w-12 md:h-16 rounded-xl bg-[#112D4E] hover:bg-sffl-red text-white flex items-center justify-center border border-white/20 transition-all active:scale-95 shadow-md cursor-pointer"
                            aria-label="Next player"
                        >
                            <ChevronRightIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    {/* Pagination Dots */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                        {players.map((p, idx) => (
                            <button
                                key={p.id || idx}
                                type="button"
                                onClick={() => setSelectedIndex(idx)}
                                className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                                    idx === selectedIndex ? 'w-6 bg-[#F4CA67]' : 'w-2 bg-[#42607E] hover:bg-gray-400'
                                }`}
                                aria-label={`Select ${p.player?.name || 'player'}`}
                                aria-pressed={idx === selectedIndex}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
