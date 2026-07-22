import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        showDetails: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, showDetails: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        this.setState({ hasError: false, error: null, showDetails: false });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private toggleDetails = () => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const isChunkLoadError =
                this.state.error?.name === 'ChunkLoadError' ||
                this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
                this.state.error?.message?.includes('Importing a module script failed');

            return (
                <div className="min-h-[500px] flex items-center justify-center p-4 md:p-8 my-6">
                    <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
                        {/* Top Decorative Brand Bar */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-sffl-navy via-sffl-red to-amber-500" />

                        <div className="p-6 md:p-8 text-center space-y-5">
                            {/* Showtime Logo */}
                            <div className="flex justify-center">
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-inner">
                                    <img
                                        src="/images/branding/showtime-logo.png"
                                        alt="Showtime Flag Football League"
                                        className="h-12 md:h-14 w-auto object-contain drop-shadow"
                                    />
                                </div>
                            </div>

                            {/* Status Tag */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/40">
                                <span>⚠️ System Stoppage</span>
                            </div>

                            {/* Main Heading & Narrative */}
                            <div className="space-y-2">
                                <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white tracking-tight">
                                    {isChunkLoadError ? 'New Update Available' : "Sorry, there's been an error"}
                                </h1>
                                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
                                    {isChunkLoadError
                                        ? 'A new code update was deployed or your internet connection interrupted module loading. Refreshing will load the latest version.'
                                        : 'An unexpected issue occurred while rendering this page on Showtime. You can attempt to retry, refresh, or return to the main dashboard.'}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={this.handleReset}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl border border-gray-200 dark:border-gray-700 transition-all shadow-sm active:scale-95"
                                >
                                    🔄 Try again
                                </button>
                                <button
                                    type="button"
                                    onClick={this.handleReload}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                                >
                                    ⚡ Refresh page
                                </button>
                                <button
                                    type="button"
                                    onClick={this.handleGoHome}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                                >
                                    🏠 Home
                                </button>
                            </div>

                            {/* Collapsible Technical Error Details */}
                            {this.state.error?.message && !isChunkLoadError && (
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        type="button"
                                        onClick={this.toggleDetails}
                                        className="text-[11px] font-bold text-gray-400 hover:text-sffl-navy dark:hover:text-white transition-colors"
                                    >
                                        {this.state.showDetails ? 'Hide technical log ▲' : 'Show technical log ▼'}
                                    </button>
                                    {this.state.showDetails && (
                                        <div className="mt-3 p-3 bg-gray-900 text-red-300 rounded-xl text-left font-mono text-[11px] leading-snug overflow-x-auto max-h-36 border border-gray-800">
                                            <div className="font-bold text-gray-500 mb-1 text-[10px] uppercase">Exception Trace</div>
                                            {this.state.error.name}: {this.state.error.message}
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

        return this.props.children;
    }
}
