import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon,
    NoSymbolIcon,
    PlayCircleIcon,
    SignalIcon,
    VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { liveApi, type AdminLiveStatus } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { getApiErrorMessage } from '../../utils/apiError';

type Mode = 'auto' | 'on' | 'off' | 'video';

const MODES: { id: Mode; label: string; blurb: string }[] = [
    {
        id: 'auto',
        label: 'Automatic',
        blurb: 'We watch the YouTube channel. The moment a stream starts, the homepage carousel becomes the live player — and it turns back into the carousel when the stream ends. Nobody has to do anything.',
    },
    {
        id: 'on',
        label: 'Live Stream',
        blurb: 'Force live stream mode. Always displays the stream on the homepage hero with the red LIVE / ON AIR indicator, whatever YouTube says.',
    },
    {
        id: 'video',
        label: 'Featured Video',
        blurb: 'Show a featured YouTube video (game replay, highlights, promo) on the homepage hero instead of the carousel. Does not trigger LIVE badges.',
    },
    {
        id: 'off',
        label: 'Carousel',
        blurb: 'Never show a live stream or featured video, even if the channel is streaming. Keeps the homepage strictly on the carousel slides.',
    },
];

const MODE_ICONS = {
    auto: SignalIcon,
    on: PlayCircleIcon,
    video: VideoCameraIcon,
    off: NoSymbolIcon,
} as const;

export const AdminLiveStream = () => {
    const { data: status, isLoading } = useQuery({
        queryKey: ['adminLiveStatus'],
        queryFn: liveApi.getAdminStatus,
        // The panel is a live dashboard — keep detection fresh while it's open.
        refetchInterval: 30_000,
    });

    if (isLoading || !status) return <Loader />;

    return (
        <div className="space-y-8 pb-36 md:pb-12">
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
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-4 sm:p-6 md:p-8 rounded-3xl shadow-xl border border-gray-200/80 dark:border-gray-700/80">
        <div className="flex items-center gap-3 mb-2 min-w-0">
            <div className="p-2.5 bg-sffl-red/10 text-sffl-red rounded-xl shrink-0">
                <SignalIcon className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-sffl-navy dark:text-white uppercase wrap-break-word min-w-0">
                Homepage Hero & Live Stream
            </h1>
        </div>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-3xl">
            Controls what visitors see at the top of the homepage: automatic stream detection, forced live stream, a featured YouTube video, or the standard carousel slides.
        </p>
    </div>
);

const StatusCards = ({ status }: { status: AdminLiveStatus }) => {
    const queryClient = useQueryClient();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* What the homepage is doing right now */}
            <div className={`p-4 sm:p-6 rounded-3xl shadow-xl border relative overflow-hidden ${status.is_live
                ? 'bg-linear-to-br from-sffl-red to-sffl-navy text-white border-white/10'
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
                            className="inline-flex items-center gap-1.5 min-h-11 mt-2 max-w-full text-xs font-mono bg-white/15 px-2.5 rounded-lg hover:bg-white/25 transition-colors"
                        >
                            <span className="truncate">{status.video_id}</span>
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </a>
                        <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-red-100">
                            Decided by: {status.source === 'auto' ? 'automatic detection' : 'your override'}
                        </div>
                    </>
                ) : status.mode === 'video' && (status.video_id || status.override_video_id) ? (
                    <>
                        <div className="flex items-center gap-2 mb-2 text-sffl-navy dark:text-white">
                            <VideoCameraIcon className="w-6 h-6 text-sffl-red shrink-0" aria-hidden="true" />
                            <span className="text-2xl font-black italic uppercase">Featured Video</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 truncate" title={status.title || status.override_title}>
                            {status.title || status.override_title || 'Featured YouTube video'}
                        </p>
                        <a
                            href={`https://www.youtube.com/watch?v=${status.video_id || status.override_video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 min-h-11 mt-2 max-w-full text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <span className="truncate">{status.video_id || status.override_video_id}</span>
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </a>
                        <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-400">
                            Decided by: your video override
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-black italic uppercase text-sffl-navy dark:text-white mb-2">
                            Carousel
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No live stream or featured video is showing. Visitors see the normal hero slides.
                        </p>
                    </>
                )}
            </div>

            {/* What auto-detection sees, regardless of the active mode — so an
                admin can tell whether it's safe to hand control back to auto. */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                        Automatic detection
                    </div>
                    <button
                        type="button"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['adminLiveStatus'] })}
                        className="-my-2 -mr-2 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-sffl-red hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Refresh detection"
                    >
                        <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
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
                    <span className="mt-3 inline-block max-w-full truncate text-xs font-mono bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg">
                        {status.detected_video_id}
                    </span>
                )}
            </div>
        </div>
    );
};

const inputClass = 'w-full min-h-11 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sffl-navy dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red/40';

const LiveControls = ({ status }: { status: AdminLiveStatus }) => {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<Mode>(status.mode);
    const [videoInput, setVideoInput] = useState(status.override_video_id);
    const [title, setTitle] = useState(status.override_title);
    const [confirming, setConfirming] = useState(false);

    const needsVideo = mode === 'on' || mode === 'video';

    const save = useMutation({
        mutationFn: () => liveApi.setOverride({ mode, video_id: videoInput, title }),
        onSuccess: (updated: AdminLiveStatus) => {
            queryClient.setQueryData(['adminLiveStatus'], updated);
            // The public badge and hero read a different key — nudge them so
            // the change shows up without waiting out their poll.
            queryClient.invalidateQueries({ queryKey: ['liveStatus'] });
            toast.success(
                updated.mode === 'video'
                    ? 'Saved — the homepage is showing the featured video.'
                    : updated.is_live
                        ? 'Saved — the homepage is showing the live stream.'
                        : 'Saved — the homepage is showing the carousel.'
            );
            setConfirming(false);
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err, 'Could not save the hero settings.'));
            setConfirming(false);
        },
    });

    const modeLabel = MODES.find(m => m.id === mode)?.label;

    return (
        <>
            <div className="space-y-4">
                <h2 className="text-lg font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                    Who decides?
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {MODES.map(m => {
                        const active = mode === m.id;
                        const Icon = MODE_ICONS[m.id];
                        return (
                            <button
                                key={m.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setMode(m.id)}
                                className={`text-left p-4 sm:p-5 rounded-3xl border transition-all duration-300 ${active
                                    ? 'bg-white dark:bg-gray-800 border-sffl-red ring-2 ring-sffl-red/30 shadow-lg'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-sffl-red' : 'text-gray-400'}`} aria-hidden="true" />
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

            {/* Video fields — shown for "Live Stream" or "Featured Video" */}
            {needsVideo && (
                <div className="p-4 sm:p-6 md:p-8 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            YouTube link or video ID <span className="text-sffl-red">*</span>
                        </label>
                        <input
                            value={videoInput}
                            onChange={e => setVideoInput(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                            className={inputClass}
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                            <p className="text-xs text-gray-400">
                                Paste any YouTube link — watch, youtu.be, /live/ or /embed/ — or just the video ID. We'll work it out.
                            </p>
                            {status.detected_live && status.detected_video_id && (
                                <button
                                    type="button"
                                    onClick={() => setVideoInput(status.detected_video_id!)}
                                    className="min-h-11 text-xs font-bold text-sffl-red hover:underline"
                                >
                                    Use the detected stream ({status.detected_video_id})
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            {mode === 'video' ? 'Video caption / title (optional)' : 'Caption (optional)'}
                        </label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={mode === 'video' ? 'Week 5 Highlights — Game of the Week' : 'Bowl 14 Semifinal — Rebels vs Knights'}
                            className={inputClass}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            {mode === 'video' ? 'Shown in player accessibility metadata and admin dashboard.' : 'Shown next to the LIVE badge on the player.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={save.isPending || (needsVideo && !videoInput.trim())}
                    className="w-full sm:w-auto min-h-11 px-8 py-3.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                    Apply to homepage
                </button>
                <p className="text-xs text-gray-400 text-center sm:text-left">
                    Visitors pick the change up within about a minute — no refresh needed on their end.
                </p>
            </div>

            <ConfirmDialog
                open={confirming}
                title="Apply to the homepage?"
                description="This changes what every visitor sees at the top of the homepage."
                body={
                    <ConfirmSummary rows={[
                        ['Mode', modeLabel],
                        ...(needsVideo ? [
                            ['Video', videoInput.trim()],
                            ['Caption', title.trim()],
                        ] as [string, string][] : []),
                    ]} />
                }
                confirmLabel="Apply to Homepage"
                tone="info"
                icon={SignalIcon}
                pending={save.isPending}
                onConfirm={() => save.mutate()}
                onCancel={() => setConfirming(false)}
            />
        </>
    );
};

export default AdminLiveStream;
