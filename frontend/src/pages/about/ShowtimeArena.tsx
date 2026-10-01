import {
  MapPinIcon,
  PencilSquareIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { PitchIcon } from "../../components/icons/PitchIcon";

// Heroicons has no drink or car, so these two are drawn in their outline style.
const DrinkIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5.25 7.5h9v11.25a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5V7.5Z" />
    <path d="M14.25 9.75h1.5a2.25 2.25 0 0 1 2.25 2.25v1.5a2.25 2.25 0 0 1-2.25 2.25h-1.5" />
    <path d="M5.25 7.5a2.25 2.25 0 0 1 2.25-3h.38a2.25 2.25 0 0 1 4.24 0h.38a2.25 2.25 0 0 1 2.25 3" />
    <path d="M8.25 11.25v5.25M11.25 11.25v5.25" />
  </svg>
);

const CarIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5.25 12.75 6.9 8.3a1.5 1.5 0 0 1 1.4-.97h7.4a1.5 1.5 0 0 1 1.4.97l1.65 4.45" />
    <path d="M3.75 12.75h16.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75Z" />
    <path d="M6 17.25v1.5M18 17.25v1.5M6.75 15h1.5M15.75 15h1.5" />
  </svg>
);

export const ShowtimeArena = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl relative overflow-hidden h-75 md:h-112.5 flex flex-col justify-end">
        <img
          src="/images/branding/showtime-arena-main.jpg"
          alt="Showtime Arena"
          className="absolute inset-0 w-full h-full object-cover opacity-60 z-0"
        />
        <div className="absolute inset-0 bg-linear-to-t from-sffl-navy/90 via-sffl-navy/40 to-transparent z-10" />
        <div className="relative z-20">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            SHOWTIME ARENA
          </h1>
          <p className="text-gray-300 mt-2 font-bold uppercase tracking-widest text-sm">
            The Premium Hub of the SFFL
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 p-4 sm:p-8 rounded-xl shadow-md space-y-6">
        <h2 className="text-2xl font-bold text-sffl-red">
          Experience the Game Night
        </h2>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">
          Located at <strong>Meadow Hall Way, Alma Beach Estate, Lekki</strong>,
          the Showtime Arena is the premier destination for flag football in
          Lagos.
        </p>

        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          Designed for both high-performance sports and entertainment, the arena
          offers a unique atmosphere where fans can enjoy evening games under
          the stars.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-6 rounded-xl">
            <h3 className="flex items-center gap-2 font-bold text-lg sm:text-xl text-sffl-navy dark:text-white mb-3">
              <PitchIcon className="w-6 h-6 shrink-0 text-sffl-red" aria-hidden="true" />
              World-Class Pitch
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              A professional-grade turf field with floodlights, allowing for
              exciting night games and excellent visibility for players and
              spectators.
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-6 rounded-xl">
            <h3 className="flex items-center gap-2 font-bold text-lg sm:text-xl text-sffl-navy dark:text-white mb-3">
              <DrinkIcon className="w-6 h-6 shrink-0 text-sffl-red" />
              Showtime Bar & Food
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              Enjoy food and drinks at our dedicated vendor area. The Showtime
              Bar ensures you stay refreshed while cheering for your team.
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-6 rounded-xl">
            <h3 className="flex items-center gap-2 font-bold text-lg sm:text-xl text-sffl-navy dark:text-white mb-3">
              <CarIcon className="w-6 h-6 shrink-0 text-sffl-red" />
              Ample Parking
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              Spacious and secure parking facilities are available for all
              attendees, making your game day experience stress-free.
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-6 rounded-xl">
            <h3 className="flex items-center gap-2 font-bold text-lg sm:text-xl text-sffl-navy dark:text-white mb-3">
              <VideoCameraIcon className="w-6 h-6 shrink-0 text-sffl-red" aria-hidden="true" />
              Media Ready
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              Dedicated zones for media coverage, photographers, and content
              creators to capture every highlight.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-8">
          <a
            href="https://maps.app.goo.gl/9vP7Rgc18gVyTSdW6"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-sffl-red hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
          >
            <MapPinIcon className="w-5 h-5" aria-hidden="true" />
            <span>Navigate to Arena</span>
          </a>

          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfXTuLAF4_Nis1rlqBU7nlOH_7Mh_rRlj6yT0Hnu_kSc1N0-w/viewform?usp=dialog"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-sffl-navy hover:bg-blue-900 text-white font-bold py-4 px-6 rounded-xl text-center transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
          >
            <PencilSquareIcon className="w-5 h-5" aria-hidden="true" />
            <span>Book the Arena</span>
          </a>
        </div>
      </section>
    </div>
  );
};
