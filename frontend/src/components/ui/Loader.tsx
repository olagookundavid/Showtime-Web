export const Loader = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm transition-all">
            <div className="flex flex-col items-center">
                {/* Spinner + Logo Container */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Rotating Ring */}
                    <div className="absolute inset-0 border-4 border-transparent border-t-sffl-red border-b-sffl-red rounded-full animate-spin"></div>

                    {/* Logo — centered inside the ring */}
                    <div className="bg-white rounded-full p-2 shadow-xl">
                        <img
                            src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                            alt="Loading..."
                            className="w-20 h-20 object-contain animate-pulse"
                        />
                    </div>
                </div>

                {/* Text */}
                <div className="mt-8 font-black italic text-xl tracking-widest text-sffl-navy dark:text-white animate-pulse">
                    SHOWTIME<span className="text-sffl-red">WEB</span>
                </div>
            </div>
        </div>
    );
};
