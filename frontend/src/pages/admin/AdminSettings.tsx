import { useState } from 'react';
import toast from 'react-hot-toast';
import { useFont } from '../../contexts/FontContext';
import { CheckCircleIcon, ArrowPathIcon, SparklesIcon, SwatchIcon } from '@heroicons/react/24/outline';

export const AdminSettings = () => {
    const { activeFont, availableFonts, setFont, resetToDefault, isSaving } = useFont();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    const categories = ['All', 'Serif', 'Sans-serif', 'Display', 'Monospace'];

    const filteredFonts = selectedCategory === 'All'
        ? availableFonts
        : availableFonts.filter(f => f.category === selectedCategory);

    const handleSelectFont = async (fontId: string, fontName: string) => {
        try {
            await setFont(fontId);
            toast.success(`App-wide font changed to ${fontName}.`);
        } catch {
            toast.error(`Could not save the font change. The site is still using ${activeFont.name}.`);
        }
    };

    const handleReset = async () => {
        try {
            await resetToDefault();
            toast.success('App-wide font reset to default (Georgia).');
        } catch {
            toast.error('Could not reset the font. Please try again.');
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Page Header */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200/80 dark:border-gray-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-sffl-red/10 text-sffl-red rounded-xl">
                            <SwatchIcon className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-sffl-navy dark:text-white uppercase">
                            App Settings & Typography
                        </h1>
                    </div>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                        Customize global, app-wide display settings. Changing the typography updates every page, component, table, and header instantly across the entire platform.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleReset}
                        disabled={isSaving}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sffl-navy dark:text-white font-bold text-xs md:text-sm rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:hover:scale-100"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Reset to Georgia
                    </button>
                </div>
            </div>

            {/* Current Active Font Banner */}
            <div className="bg-gradient-to-r from-sffl-navy via-sffl-navy/95 to-sffl-red text-white p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/10">
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-red-200">
                        <SparklesIcon className="w-4 h-4 text-yellow-300" />
                        Currently Active App Font
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black italic tracking-tight" style={{ fontFamily: activeFont.fontFamily }}>
                        {activeFont.name} {activeFont.isDefault && '(Default)'}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-200 max-w-xl">
                        {activeFont.description}
                    </p>
                </div>

                <div className="relative z-10 bg-white/10 backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/15 min-w-[240px] space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">Category</div>
                    <div className="text-lg font-black text-white">{activeFont.category}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-300 font-bold mt-2">CSS Font Stack</div>
                    <div className="text-xs font-mono text-gray-200 truncate max-w-[220px]" title={activeFont.fontFamily}>
                        {activeFont.fontFamily}
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Category Filter:</span>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${selectedCategory === cat
                                ? 'bg-sffl-red text-white shadow-md scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Font Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredFonts.map(font => {
                    const isActive = activeFont.id === font.id;
                    return (
                        <div
                            key={font.id}
                            className={`bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 border transition-all duration-300 flex flex-col justify-between shadow-lg relative ${isActive
                                    ? 'border-sffl-red ring-2 ring-sffl-red/30 shadow-red-500/10'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-xl'
                                }`}
                        >
                            {/* Font Header */}
                            <div>
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-black text-sffl-navy dark:text-white" style={{ fontFamily: font.fontFamily }}>
                                            {font.name}
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {font.category}
                                        </span>
                                    </div>

                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            ACTIVE {font.isDefault && '(DEFAULT)'}
                                        </span>
                                    ) : font.isDefault && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            Default
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">
                                    {font.description}
                                </p>

                                {/* Live Specimen Preview Box */}
                                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-700/80 space-y-4 mb-6">
                                    <div className="border-b border-gray-200 dark:border-gray-700/80 pb-3">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Headline Sample</span>
                                        <p className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white leading-tight" style={{ fontFamily: font.fontFamily }}>
                                            Showtime Flag Football League 2026
                                        </p>
                                    </div>

                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Body Text Sample</span>
                                        <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed" style={{ fontFamily: font.fontFamily }}>
                                            Nigeria's premier flag football competition. Real-time scores, player stats, playoff brackets, and ticket bookings.
                                        </p>
                                    </div>

                                    <div className="pt-2 flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-sffl-red text-white text-xs font-bold rounded-xl shadow-sm"
                                            style={{ fontFamily: font.fontFamily }}
                                        >
                                            Sample Action Button
                                        </button>
                                        <span className="text-xs font-bold text-sffl-navy dark:text-white" style={{ fontFamily: font.fontFamily }}>
                                            42 - 38 Final Score
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Activate Action */}
                            <div className="pt-2">
                                <button
                                    onClick={() => handleSelectFont(font.id, font.name)}
                                    disabled={isActive || isSaving}
                                    className={`w-full py-3 px-4 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 ${isActive
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-600'
                                            : 'bg-sffl-navy hover:bg-sffl-red text-white shadow-md hover:shadow-lg active:scale-95'
                                        }`}
                                >
                                    {isActive ? (
                                        <>
                                            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                            Currently Applied App Font
                                        </>
                                    ) : (
                                        `Activate ${font.name} App-Wide`
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminSettings;
