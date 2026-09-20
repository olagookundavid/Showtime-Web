import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showDetails: boolean;
    stage: 'refresh' | 'developer_working';
}

const RETRY_STORAGE_KEY = 'sffl_error_boundary_refresh_timestamp';

/**
 * Checks if a reload was already attempted recently (< 60 seconds ago) for an error.
 * If so, subsequent crashes jump straight to Stage 2 ("It's not you, it's us").
 */
function didRecentRefreshHappen(): boolean {
    try {
        const item = sessionStorage.getItem(RETRY_STORAGE_KEY);
        if (!item) return false;
        const timestamp = parseInt(item, 10);
        if (!isNaN(timestamp) && Date.now() - timestamp < 60000) {
            return true;
        }
    } catch {
        // In case sessionStorage is blocked by security settings
    }
    return false;
}

function recordRefreshAttempt(): void {
    try {
        sessionStorage.setItem(RETRY_STORAGE_KEY, String(Date.now()));
    } catch {
        // ignore
    }
}

function clearRefreshAttempt(): void {
    try {
        sessionStorage.removeItem(RETRY_STORAGE_KEY);
    } catch {
        // ignore
    }
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        showDetails: false,
        stage: 'refresh',
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        const hadRecentRefresh = didRecentRefreshHappen();
        return {
            hasError: true,
            error,
            showDetails: false,
            stage: hadRecentRefresh ? 'developer_working' : 'refresh',
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    }

    private handleReload = () => {
        recordRefreshAttempt();
        try {
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (const name of names) caches.delete(name);
                });
            }
        } catch {
            // ignore
        }
        window.location.reload();
    };

    private handleReset = () => {
        clearRefreshAttempt();
        this.setState({ hasError: false, error: null, showDetails: false, stage: 'refresh' });
    };

    private handleGoHome = () => {
        clearRefreshAttempt();
        window.location.href = '/';
    };

    private handleClearCacheReload = () => {
        clearRefreshAttempt();
        try {
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (const name of names) caches.delete(name);
                });
            }
        } catch {
            // ignore
        }
        const url = new URL(window.location.href);
        url.searchParams.set('_sffl_r', String(Date.now()));
        window.location.href = url.toString();
    };

    private toggleDetails = () => {
        this.setState((prev) => ({ showDetails: !prev.showDetails }));
    };

    public render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        const isChunkLoadError =
            this.state.error?.name === 'ChunkLoadError' ||
            this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
            this.state.error?.message?.includes('Importing a module script failed');

        const { stage, showDetails, error } = this.state;

        return (
            <div className="min-h-[520px] flex items-center justify-center p-4 md:p-8 my-6">
                <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
                    {/* Top Decorative Brand Gradient Bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-sffl-navy via-sffl-red to-amber-500" />

                    <div className="p-6 md:p-8 text-center space-y-5">
                        {/* ========================================================================= */}
                        {/* STAGE 1: "There must have been a change to this webpage, kindly refresh" */}
                        {/* ========================================================================= */}
                        {stage === 'refresh' && (
                            <>
                                {/* Play Under Review / Referee GIF */}
                                <div className="mx-auto w-full max-w-[280px] h-44 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shadow-md flex items-center justify-center relative">
                                    <img
                                        src="https://media.giphy.com/media/Uctcqtk0jEFI/giphy.gif"
                                        alt="Referee timeout"
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Fallback high-reliability referee review gif
                                            e.currentTarget.src = "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif";
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                                </div>

                                {/* Status Tag */}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-black uppercase tracking-wider border border-amber-200 dark:border-amber-900/40">
                                    <span>⏱️ Quick Timeout on the Play</span>
                                </div>

                                {/* Main Heading & Narrative */}
                                <div className="space-y-2">
                                    <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white tracking-tight">
                                        There must have been a change to this page!
                                    </h1>
                                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
                                        We may have just deployed a fresh play or this screen hit a momentary pause. Kindly hit refresh to catch the latest update!
                                    </p>
                                </div>

                                {/* Primary Call to Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={this.handleReload}
                                        className="w-full sm:w-auto px-6 py-3 bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-sffl-red/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <span>⚡ Kindly Refresh</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={this.handleReset}
                                        className="w-full sm:w-auto px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-gray-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                                    >
                                        🔄 Try again
                                    </button>
                                    <button
                                        type="button"
                                        onClick={this.handleGoHome}
                                        className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl border border-gray-300 dark:border-gray-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                                    >
                                        🏠 Home
                                    </button>
                                </div>

                                {/* Escalation link if refresh does not solve the issue */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            recordRefreshAttempt();
                                            this.setState({ stage: 'developer_working' });
                                        }}
                                        className="text-xs font-semibold text-gray-500 hover:text-sffl-red dark:text-gray-400 dark:hover:text-gray-200 underline decoration-dotted transition-colors cursor-pointer"
                                    >
                                        Refresh didn't work? It might be on our end →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ========================================================================= */}
                        {/* STAGE 2: "It's not you, but us! Our developers are working on it" */}
                        {/* ========================================================================= */}
                        {stage === 'developer_working' && (
                            <>
                                {/* Developers Working / Cool Frantic Typing GIF */}
                                <div className="mx-auto w-full max-w-[280px] h-44 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shadow-md flex items-center justify-center relative">
                                    <img
                                        src="https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif"
                                        alt="Our developers are furiously working on it"
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Fallback IT hard at work gif
                                            e.currentTarget.src = "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif";
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                                </div>

                                {/* Status Tag */}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-wider border border-red-200 dark:border-red-900/40">
                                    <span>🛠️ It's Not You, It's Us</span>
                                </div>

                                {/* Main Heading & Narrative */}
                                <div className="space-y-2">
                                    <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white tracking-tight">
                                        It's not you, it's definitely us!
                                    </h1>
                                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
                                        An unexpected fumble occurred on our end. Our developers have been notified and are already on the field working hard to fix it.
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={this.handleGoHome}
                                        className="w-full sm:w-auto px-6 py-3 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                                    >
                                        🏠 Return Home
                                    </button>
                                    <button
                                        type="button"
                                        onClick={this.handleClearCacheReload}
                                        className="w-full sm:w-auto px-5 py-3 bg-sffl-red hover:bg-[#A52323] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                                        title="Flush browser cache and reload the application fresh"
                                    >
                                        🧹 Clear Cache &amp; Reload
                                    </button>
                                    <button
                                        type="button"
                                        onClick={this.handleReset}
                                        className="w-full sm:w-auto px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-gray-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                                    >
                                        🔄 Try Again
                                    </button>
                                </div>

                                {/* Friendly Support Contact Note */}
                                <div className="pt-2">
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                        Need help right away? Reach out to us at{' '}
                                        <a
                                            href="mailto:support@showtimeflag.com"
                                            className="text-sffl-red font-semibold hover:underline"
                                        >
                                            support@showtimeflag.com
                                        </a>
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Collapsible Technical Error Details (Available in both stages) */}
                        {error?.message && !isChunkLoadError && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={this.toggleDetails}
                                    className="text-[11px] font-bold text-gray-400 hover:text-sffl-navy dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    {showDetails ? 'Hide technical log ▲' : 'Show technical log ▼'}
                                </button>
                                {showDetails && (
                                    <div className="mt-3 p-3 bg-gray-950 text-red-300 rounded-xl text-left font-mono text-[11px] leading-snug overflow-x-auto max-h-40 border border-gray-800">
                                        <div className="font-bold text-gray-500 mb-1 text-[10px] uppercase tracking-wider">Exception Trace</div>
                                        <p className="text-red-400 font-semibold mb-1">
                                            {error.name}: {error.message}
                                        </p>
                                        {error.stack && (
                                            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all mt-1">
                                                {error.stack}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Card Footer */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center font-semibold">
                        Showtime Flag Football League · Official Web Operating System
                    </div>
                </div>
            </div>
        );
    }
}
