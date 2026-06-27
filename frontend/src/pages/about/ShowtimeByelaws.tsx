export const ShowtimeByelaws = () => {
    const pdfUrl = "https://cdn.showtimeflag.football/pdfs/showtime_bye_laws_and_constitution.pdf";

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">SHOWTIME BYELAWS & CONSTITUTION</h1>
                <p className="text-gray-300 mt-2">League governance and regulations</p>
            </div>

            {/* Desktop & Tablet Layout: Embedded PDF Viewer */}
            <section className="hidden md:block bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-700 pb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white">Official Byelaws & Constitution</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Browse the official guidelines, governance regulations, and league constitution below.
                        </p>
                    </div>
                    <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-lg shadow transition active:scale-95"
                    >
                        <span>📥</span>
                        <span>Download PDF</span>
                    </a>
                </div>

                <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-xl p-2 border border-gray-200 dark:border-gray-700 shadow-inner">
                    <iframe
                        src={`${pdfUrl}#toolbar=1`}
                        title="Showtime Flag Football Byelaws"
                        className="w-full h-[800px] rounded-lg border-0 bg-white"
                        loading="lazy"
                    />
                </div>
            </section>

            {/* Mobile Layout: Premium Preview Card */}
            <section className="block md:hidden bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                <div className="bg-gradient-to-br from-sffl-navy to-blue-900 text-white p-6 rounded-xl relative overflow-hidden shadow-lg">
                    {/* Decorative Background Icon */}
                    <div className="absolute right-[-20px] bottom-[-20px] text-white/10 text-9xl font-black pointer-events-none select-none">
                        PDF
                    </div>

                    <div className="relative z-10 space-y-4">
                        <span className="inline-block bg-sffl-red text-white text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                            Official Document
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight">Byelaws & Constitution</h2>
                        <p className="text-gray-200 text-sm leading-relaxed">
                            Access the complete Showtime Flag Football League byelaws, league governance, and constitutional regulations.
                        </p>
                        
                        <div className="flex flex-col gap-3 pt-2">
                            <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full text-center bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition active:scale-95 shadow-md flex items-center justify-center gap-2"
                            >
                                <span>📖</span>
                                <span>Open Byelaws</span>
                            </a>
                            <a
                                href={pdfUrl}
                                download
                                className="w-full text-center bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 px-6 rounded-lg transition active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span>📥</span>
                                <span>Download PDF</span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
