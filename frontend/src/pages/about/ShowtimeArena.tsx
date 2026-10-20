import {
  MapPinIcon,
  PencilSquareIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { PitchIcon, buttonClass, type HeroIcon } from "../../components";

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

const FEATURES: { icon: HeroIcon; title: string; body: string }[] = [
  {
    icon: PitchIcon,
    title: "World-Class Pitch",
    body: "A professional-grade turf field with floodlights, allowing for exciting night games and excellent visibility for players and spectators.",
  },
  {
    icon: DrinkIcon,
    title: "Showtime Bar & Food",
    body: "Enjoy food and drinks at our dedicated vendor area. The Showtime Bar ensures you stay refreshed while cheering for your team.",
  },
  {
    icon: CarIcon,
    title: "Ample Parking",
    body: "Spacious and secure parking facilities are available for all attendees, making your game day experience stress-free.",
  },
  {
    icon: VideoCameraIcon,
    title: "Media Ready",
    body: "Dedicated zones for media coverage, photographers, and content creators to capture every highlight.",
  },
];

const FeatureCard = ({
  icon: Icon,
  title,
  children,
}: {
  icon: HeroIcon;
  title: string;
  children: ReactNode;
}) => (
  <article className="group flex flex-col border border-gray-200 dark:border-gray-700 border-t-4 border-t-sffl-red bg-white dark:bg-gray-800 p-5 sm:p-6">
    <h3 className="flex items-center gap-3 text-lg sm:text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mb-3">
      <Icon className="w-6 h-6 shrink-0 text-sffl-red" aria-hidden="true" />
      {title}
    </h3>
    <span className="h-1 w-10 bg-sffl-red mb-3" aria-hidden="true" />
    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
      {children}
    </p>
  </article>
);

export const ShowtimeArena = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Plan Your Visit — address + CTAs get top billing since "get
          directions" is the single most-needed action on a venue page. */}
      <section className="bg-linear-to-r from-gray-900 to-sffl-navy text-white p-5 sm:p-8 md:p-10">
        <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80 mb-4">
          <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
          Plan Your Visit
        </p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase mb-4 wrap-break-word">
          Meadow Hall Way, Alma Beach Estate, Lekki
        </h2>
        <p className="text-base sm:text-lg text-gray-200 lg:w-3/4 mb-8">
          The Showtime Arena is the premier destination for flag football in
          Lagos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-xl">
          <a
            href="https://maps.app.goo.gl/9vP7Rgc18gVyTSdW6"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "lg", true, "", "dark")}
          >
            <MapPinIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
            Navigate to Arena
          </a>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfXTuLAF4_Nis1rlqBU7nlOH_7Mh_rRlj6yT0Hnu_kSc1N0-w/viewform?usp=dialog"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("outline", "lg", true, "", "dark")}
          >
            <PencilSquareIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
            Book the Arena
          </a>
        </div>
      </section>

      {/* Atmosphere intro */}
      <section className="p-5 sm:p-8">
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-black text-sffl-navy dark:text-white uppercase">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          Experience the Game Night
        </h2>
        <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
          Designed for both high-performance sports and entertainment, the
          arena offers a unique atmosphere where fans can enjoy evening games
          under the stars.
        </p>
      </section>

      {/* Arena features */}
      <div className="p-5 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl md:text-2xl font-black uppercase text-sffl-navy dark:text-white tracking-tight">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          Arena Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
            >
              {feature.body}
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  );
};
