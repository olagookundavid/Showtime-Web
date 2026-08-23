import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SignalIcon, ArrowPathIcon, PlayCircleIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { liveApi, type AdminLiveStatus } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

type Mode = 'auto' | 'on' | 'off';

const MODES: { id: Mode; label: string; blurb: string }[] = [
    {
        id: 'auto',
        label: 'Automatic',
        blurb: 'We watch the YouTube channel. The moment a stream starts, the homepage carousel becomes the live player — and it turns back into the carousel when the stream ends. Nobody has to do anything.',
    },
    {
        id: 'on',
        label: 'Force live',
        blurb: 'Always show the video below, whatever YouTube says. Use this for an unlisted stream, or when automatic detection is slow to notice. Remember to switch back to Automatic afterwards.',
    },
    {
        id: 'off',
        label: 'Force carousel',
        blurb: 'Never show a live player, even if the channel is streaming. Use this to keep the homepage on the carousel during a test or private broadcast.',
    },
];

const errorMessage = (err: unknown, fallback: string): string => {
    const res = (err as { response?: { data?: { error?: string } } })?.response;
    return res?.data?.error || fallback;
};

export const AdminLiveStream = () => {
    const { data: status, isLoading } = useQuery({
        queryKey: ['adminLiveStatus'],
        queryFn: liveApi.getAdminStatus,
        // The panel is a live dashboard — keep detection fresh while it's open.
        refetchInterval: 30_000,
    });

    if (isLoading || !status) return <Loader />;

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-12">
            <Header />
            <StatusCards status={status} />
            {/* Keying on the saved values makes the form re-seed itself whenever
                the server state actually changes, which avoids syncing props
                into state with an effect. A background refetch that returns the
                same values leaves whatever the admin is typing alone. */}
            <LiveControls
                key={`${status.mode}|${status.override_video_id}|${status.override_title}`}
                status={status}
            />
        </div>
    );
};

const Header = () => (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200/80 dark:border-gray-700/80">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-sffl-red/10 text-sffl-red rounded-xl">
                <SignalIcon className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-sffl-navy dark:text-white uppercase">
                Live Stream
            </h1>
        </div>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-3xl">
            Controls what visitors see at the top of the homepage. When we're live, the hero carousel
            is replaced by the stream and a red LIVE badge appears in the navigation on every page.
        </p>
    </div>
);

const StatusCards = ({ status }: { status: AdminLiveStatus }) => {
    const queryClient = useQueryClient();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* What the homepage is doing right now */}
            <div className={`p-6 rounded-3xl shadow-xl border relative overflow-hidden ${status.is_live
                ? 'bg-gradient-to-br from-sffl-red to-sffl-navy text-white border-white/10'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                <div className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${status.is_live ? 'text-red-100' : 'text-gray-400'}`}>
                    Homepage right now
                </div>
                {status.is_live ? (
                    <>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                            <span className="text-2xl font-black italic uppercase">On air</span>
                        </div>
                        <p className="text-sm text-gray-100 truncate" title={status.title}>
                            {status.title || 'Live stream'}
                        </p>
                        <a
                            href={`https://www.youtube.com/watch?v=${status.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-3 text-xs font-mono bg-white/15 px-2.5 py-1 rounded-lg hover:bg-white/25 transition-colors"
                        >
                            {status.video_id} ↗
                        </a>
                        <div className="mt-3 text-[10px] uppercase tracking-widest font-bold text-red-100">
                            Decided by: {status.source === 'auto' ? 'automatic detection' : 'your override'}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-black italic uppercase text-sffl-navy dark:text-white mb-2">
                            Carousel
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No live stream is showing. Visitors see the normal hero slides.
                        </p>
                    </>
                )}
            </div>

            {/* What auto-detection sees, regardless of the active mode — so an
                admin can tell whether it's safe to hand control back to auto. */}
            <div className="p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                        Automatic detection
                    </div>
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['adminLiveStatus'] })}
                        className="text-gray-400 hover:text-sffl-red transition-colors"
                        aria-label="Refresh detection"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-2xl font-black italic uppercase text-sffl-navy dark:text-white mb-2">
                    {status.detected_live ? 'Channel is live' : 'Channel is offline'}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={status.detected_title}>
                    {status.detected_live
                        ? status.detected_title || 'Live broadcast detected'
                        : `Nothing streaming on @${status.channel_handle}`}
                </p>
                {status.detected_live && status.detected_video_id && (
                    <span className="mt-3 inline-block text-xs font-mono bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg">
                        {status.detected_video_id}
                    </span>
                )}
            </div>
        </div>
    );
};

const LiveControls = ({ status }: { status: AdminLiveStatus }) => {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<Mode>(status.mode);
    const [videoInput, setVideoInput] = useState(status.override_video_id);
    const [title, setTitle] = useState(status.override_title);

    const save = useMutation({
        mutationFn: () => liveApi.setOverride({ mode, video_id: videoInput, title }),
        onSuccess: (updated: AdminLiveStatus) => {
            queryClient.setQueryData(['adminLiveStatus'], updated);
            // The public badge and hero read a different key — nudge them so
            // the change shows up without waiting out their poll.
            queryClient.invalidateQueries({ queryKey: ['liveStatus'] });
            toast.success(
                updated.is_live
                    ? 'Saved — the homepage is showing the live stream.'
                    : 'Saved — the homepage is showing the carousel.'
            );
        },
        onError: (err: unknown) => {
            toast.error(errorMessage(err, 'Could not save the live settings.'));
        },
    });

    return (
        <>
            <div className="space-y-4">
                <h2 className="text-lg font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                    Who decides?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {MODES.map(m => {
                        const active = mode === m.id;
                        const Icon = m.id === 'auto' ? SignalIcon : m.id === 'on' ? PlayCircleIcon : NoSymbolIcon;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setMode(m.id)}
                                className={`text-left p-5 rounded-3xl border transition-all duration-300 ${active
                                    ? 'bg-white dark:bg-gray-800 border-sffl-red ring-2 ring-sffl-red/30 shadow-lg'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`w-5 h-5 ${active ? 'text-sffl-red' : 'text-gray-400'}`} />
                                    <span className="font-black uppercase text-sm text-sffl-navy dark:text-white">
                                        {m.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {m.blurb}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Video fields — only meaningful for "Force live" */}
            {mode === 'on' && (
                <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            YouTube link or video ID <span className="text-sffl-red">*</span>
                        </label>
                        <input
                            value={videoInput}
                            onChange={e => setVideoInput(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sffl-navy dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red/40"
                        />
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <p className="text-xs text-gray-400">
                                Paste any YouTube link — watch, youtu.be, /live/ or /embed/ — or just the video ID. We'll work it out.
                            </p>
                            {status.detected_live && status.detected_video_id && (
                                <button
                                    type="button"
                                    onClick={() => setVideoInput(status.detected_video_id!)}
                                    className="text-xs font-bold text-sffl-red hover:underline"
                                >
                                    Use the detected stream ({status.detected_video_id})
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Caption (optional)
                        </label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Bowl 14 Semifinal — Rebels vs Knights"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sffl-navy dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red/40"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            Shown next to the LIVE badge on the player.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                    onClick={() => save.mutate()}
                    disabled={save.isPending || (mode === 'on' && !videoInput.trim())}
                    className="w-full sm:w-auto px-8 py-3.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {save.isPending ? 'Saving…' : 'Apply to homepage'}
                </button>
                <p className="text-xs text-gray-400 text-center sm:text-left">
                    Visitors pick the change up within about a minute — no refresh needed on their end.
                </p>
            </div>
        </>
    );
};

export default AdminLiveStream;
