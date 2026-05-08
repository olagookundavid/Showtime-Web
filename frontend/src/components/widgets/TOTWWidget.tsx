import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLatestTOTW } from '../../services/api';
import { LightboxImage } from '../ui';
import { StarIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export const TOTWWidget = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { data: totwData, isLoading } = useQuery({
        queryKey: ['latestTOTWWidget'],
        queryFn: () => getLatestTOTW(),
    });

    const entries = totwData?.data || [];
    const latestDate = totwData?.date || '';

    useEffect(() => {
        if (entries.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % entries.length);
        }, 500); // Rotate every 0.5 seconds

        return () => clearInterval(interval);
    }, [entries.length]);

    if (isLoading) {
        return (
            <div className="bg-sffl-navy/5 dark:bg-gray-800/50 rounded-2xl h-full p-8 flex items-center justify-center animate-pulse border border-gray-100 dark:border-gray-700">
                <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="bg-gradient-to-br from-sffl-navy to-sffl-navy-light text-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center h-full border border-white/10 group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <StarIcon className="w-24 h-24 rotate-12" />
                </div>
                <h3 className="text-xl md:text-2xl font-black italic mb-2 uppercase tracking-tight">Team of the Week</h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Latest Selection Coming Soon</p>
                <div className="w-16 h-1 bg-sffl-red rounded-full mb-4"></div>
                <p className="text-gray-300 text-sm italic">Stay tuned for this week's top performers!</p>
            </div>
        );
    }

    const currentPlayer = entries[currentIndex];

    return (
        <div className="bg-gradient-to-br from-sffl-navy to-sffl-navy-light text-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col h-full border border-white/10 group overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-sffl-red/20 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        Team of <span className="text-sffl-red">the Week</span>
                    </h3>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sffl-red animate-pulse"></span>
                        {latestDate.substring(0, 10)}
                    </p>
                </div>
                <div className="flex gap-1">
                    {entries.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-sffl-red' : 'w-1 bg-white/20'}`}
                        />
                    ))}
                </div>
            </div>

            <div className="relative flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="flex items-center gap-6">
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-sffl-red/20 rounded-2xl blur-lg animate-pulse"></div>
                        <LightboxImage 
                            src={currentPlayer.player?.image || ''} 
                            alt={currentPlayer.player?.name || ''} 
                            thumbnailClassName="w-20 h-20 md:w-28 md:h-28 rounded-2xl object-cover shadow-2xl border-2 border-white/20 relative z-10" 
                        />
                        <div className="absolute -bottom-2 -right-2 bg-sffl-red text-white text-[10px] font-black p-1.5 rounded-lg shadow-lg border-2 border-sffl-navy z-20 min-w-[2rem] text-center">
                            #{currentPlayer.player?.jersey_number}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="inline-block px-2 py-0.5 bg-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-sffl-red mb-2">
                            {currentPlayer.position_group === 'QB' ? 'Quarterback' : currentPlayer.position_group === 'WR' ? 'Wide Receiver' : 'Defense'}
                        </div>
                        <h4 className="text-xl md:text-3xl font-black italic uppercase tracking-tighter truncate leading-none mb-2">
                            {currentPlayer.player?.name}
                        </h4>
                        <div className="flex items-center gap-2">
                            <LightboxImage 
                                src={currentPlayer.player?.team?.logo || ''} 
                                alt={currentPlayer.player?.team?.name || ''} 
                                thumbnailClassName="w-5 h-5 object-contain" 
                            />
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
                                {currentPlayer.player?.team?.name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
                <Link 
                    to={`/team-of-the-week?comp=${currentPlayer?.competition_id || ''}&date=${latestDate}`} 
                    className="text-xs font-black uppercase tracking-widest text-white hover:text-sffl-red transition-colors flex items-center gap-2 group/btn"
                >
                    View ALL Stats 
                    <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                <div className="flex -space-x-2">
                    {entries.slice(0, 3).map((e, i) => (
                        <img 
                            key={i}
                            src={e.player?.image || ''} 
                            alt="" 
                            className="w-6 h-6 rounded-full border-2 border-sffl-navy object-cover grayscale opacity-50"
                        />
                    ))}
                    {entries.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-black border-2 border-sffl-navy">
                            +{entries.length - 3}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
