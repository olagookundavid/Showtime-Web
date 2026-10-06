import { useState } from 'react';
import toast from 'react-hot-toast';
import { useFont } from '../../contexts/FontContext';
import { CheckCircleIcon, ArrowPathIcon, SparklesIcon, SwatchIcon } from '@heroicons/react/24/outline';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Button } from '../../components/ui';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';

type PendingAction = { kind: 'set'; fontId: string; fontName: string; category: string } | { kind: 'reset' };

export const AdminSettings = () => {
    const { activeFont, availableFonts, setFont, resetToDefault, isSaving } = useFont();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const categories = ['All', 'Serif', 'Sans-serif', 'Display', 'Monospace'];

    const filteredFonts = selectedCategory === 'All'
        ? availableFonts
        : availableFonts.filter(f => f.category === selectedCategory);

    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        setBusy(true);
        try {
            if (pendingAction.kind === 'set') {
                try {
                    await setFont(pendingAction.fontId);
                    toast.success(`App-wide font changed to ${pendingAction.fontName}.`);
                } catch {
                    toast.error(`Could not save the font change. The site is still using ${activeFont.name}.`);
                }
            } else {
                try {
                    await resetToDefault();
                    toast.success('App-wide font reset to default (Georgia).');
                } catch {
                    toast.error('Could not reset the font. Please try again.');
                }
            }
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const dialog = pendingAction?.kind === 'set'
        ? {
            title: `Activate ${pendingAction.fontName}?`,
            description: 'This changes the typography on every page for every visitor.',
            confirmLabel: 'Activate Font',
            icon: SwatchIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Font', pendingAction.fontName],
                    ['Category', pendingAction.category],
                    ['Replaces', activeFont.name],
                ]} />
            ),
        }
        : {
            title: 'Reset to the default font?',
            description: 'This changes the typography on every page for every visitor.',
            confirmLabel: 'Reset Font',
            icon: ArrowPathIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Font', 'Georgia (default)'],
                    ['Replaces', activeFont.name],
                ]} />
            ),
        };

    return (
        <div className="space-y-8 pb-36 md:pb-12">
            <DashboardPageHeader
                title="App Settings"
                subtitle="Choose the app-wide font. It changes every page for every visitor."
                actions={
                    <Button
                        variant="secondary"
                        icon={ArrowPathIcon}
                        onClick={() => setPendingAction({ kind: 'reset' })}
                        disabled={isSaving || busy}
                        className="flex-1 md:flex-initial"
                    >
                        Reset to Georgia
                    </Button>
                }
            />

            {/* Current Active Font Banner */}
            <div className="bg-linear-to-r from-sffl-navy via-sffl-navy/95 to-sffl-red text-white p-4 sm:p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/10">
                <div className="relative z-10 space-y-2 min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-red-200">
                        <SparklesIcon className="w-4 h-4 text-yellow-300" aria-hidden="true" />
                        Currently Active App Font
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-tight wrap-break-word" style={{ fontFamily: activeFont.fontFamily }}>
                        {activeFont.name} {activeFont.isDefault && '(Default)'}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-200 max-w-xl">
                        {activeFont.description}
                    </p>
                </div>

                <div className="relative z-10 w-full md:w-auto md:min-w-60 bg-white/10 backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/15 space-y-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">Category</div>
                    <div className="text-lg font-black text-white">{activeFont.category}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-300 font-bold mt-2">CSS Font Stack</div>
                    <div className="text-xs font-mono text-gray-200 truncate md:max-w-55" title={activeFont.fontFamily}>
                        {activeFont.fontFamily}
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Category Filter:</span>
                {categories.map(cat => (
                    <Button
                        key={cat}
                        variant={selectedCategory === cat ? 'primary' : 'secondary'}
                        aria-pressed={selectedCategory === cat}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat}
                    </Button>
                ))}
            </div>

            {/* Font Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredFonts.map(font => {
                    const isActive = activeFont.id === font.id;
                    return (
                        <div
                            key={font.id}
                            className={`bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 md:p-8 border transition-all duration-300 flex flex-col justify-between shadow-lg relative ${isActive
                                    ? 'border-sffl-red ring-2 ring-sffl-red/30 shadow-red-500/10'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-xl'
                                }`}
                        >
                            {/* Font Header */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                                        <h3 className="text-2xl font-black text-sffl-navy dark:text-white wrap-break-word min-w-0" style={{ fontFamily: font.fontFamily }}>
                                            {font.name}
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {font.category}
                                        </span>
                                    </div>

                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
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
                                <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-700/80 space-y-4 mb-6">
                                    <div className="border-b border-gray-200 dark:border-gray-700/80 pb-3">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Headline Sample</span>
                                        <p className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white leading-tight wrap-break-word" style={{ fontFamily: font.fontFamily }}>
                                            Showtime Flag Football League 2026
                                        </p>
                                    </div>

                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Body Text Sample</span>
                                        <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed" style={{ fontFamily: font.fontFamily }}>
                                            Nigeria's premier flag football competition. Real-time scores, player stats, playoff brackets, and ticket bookings.
                                        </p>
                                    </div>

                                    <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <span
                                            className="px-4 py-2 bg-sffl-red text-white text-xs font-bold rounded-xl shadow-sm"
                                            style={{ fontFamily: font.fontFamily }}
                                        >
                                            Sample Action Button
                                        </span>
                                        <span className="text-xs font-bold text-sffl-navy dark:text-white" style={{ fontFamily: font.fontFamily }}>
                                            42 - 38 Final Score
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Activate Action */}
                            <div className="pt-2">
                                <Button
                                    fullWidth
                                    variant={isActive ? 'secondary' : 'primary'}
                                    icon={isActive ? CheckCircleIcon : undefined}
                                    onClick={() => setPendingAction({ kind: 'set', fontId: font.id, fontName: font.name, category: font.category })}
                                    disabled={isActive || isSaving || busy}
                                >
                                    {isActive ? 'Currently Applied App Font' : `Activate ${font.name} App-Wide`}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone="info"
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};

export default AdminSettings;
