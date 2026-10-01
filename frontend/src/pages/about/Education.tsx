import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { FootballIcon } from "../../components/icons/FootballIcon";

export const Education = () => {
    return (
        <div className="space-y-4 md:space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic tracking-tighter wrap-break-word">FLAG FOOTBALL EDUCATION</h1>
                <p className="text-gray-300 mt-2">Master the game</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-4 sm:p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Routes and Strategy</h2>
                <p className="text-gray-700 dark:text-gray-100">
                    Understanding the route tree is essential for every receiver and quarterback.
                    We have provided an official guide to the standard flag football route tree to help
                    teams and players improve their offensive execution.
                </p>

                <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-8 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mt-4">
                    <div className="min-w-0">
                        <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-sffl-navy dark:text-white mb-2">
                            <FootballIcon className="w-6 h-6 shrink-0 text-sffl-red" aria-hidden="true" />
                            Flag Football Route Tree
                        </h3>
                        <p className="text-gray-600 dark:text-gray-200">
                            Download the official visual guide to all standard passing routes.
                        </p>
                    </div>
                    <a
                        href="https://cdn.showtimeflag.football/pdfs/showtime_flag_football_route_tree.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto min-h-11 inline-flex items-center justify-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-md whitespace-nowrap"
                    >
                        <DocumentArrowDownIcon className="w-5 h-5" aria-hidden="true" />
                        Download PDF
                    </a>
                </div>

                <div className="mt-8">
                    <h3 className="text-xl font-bold text-sffl-navy dark:text-white mb-4">Coming Soon</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-100">
                        <li>Video Drills Library</li>
                        <li>Coaching Seminars</li>
                        <li>Officiating Certification Courses</li>
                    </ul>
                </div>
            </section>
        </div>
    );
};
