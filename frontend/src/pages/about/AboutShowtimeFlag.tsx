import { EyeIcon } from "@heroicons/react/24/outline";
import { FAQSection } from "./FAQSection";

// Heroicons has no target, so the mission mark is drawn in their outline
// style: three rings around a centre point.
const TargetIcon = ({ className }: { className?: string }) => (
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
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.25" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);

export const AboutShowtimeFlag = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Mission & Vision, side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="border-l-2 border-sffl-red p-5 sm:p-8">
          <h2 className="mb-4 flex items-center gap-3 text-2xl font-black text-sffl-navy dark:text-white">
            <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
            <TargetIcon className="w-8 h-8 text-sffl-red shrink-0" />
            MISSION
          </h2>
          <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
            To build a structured, professional, and commercially viable flag
            football ecosystem that develops athletes, delivers high-quality
            sporting experiences, and creates meaningful opportunities for
            partners, communities, and the next generation of talent.
          </p>
        </div>

        <div className="border-l-2 border-blue-600 p-5 sm:p-8">
          <h2 className="mb-4 flex items-center gap-3 text-2xl font-black text-sffl-navy dark:text-white">
            <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
            <EyeIcon className="w-8 h-8 text-blue-600 shrink-0" aria-hidden="true" />
            VISION
          </h2>
          <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
            To become the leading flag football platform in the World and a
            globally recognized standard for how emerging sports are
            organized, experienced, and scaled.
          </p>
        </div>
      </div>

      {/* About Us */}
      <section className="p-5 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-2xl font-black uppercase text-sffl-navy dark:text-white">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          ABOUT US
        </h2>
        <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            Showtime Flag is a premier flag football platform built to grow
            the sport, develop athletes, and create a new culture of
            competitive sport entertainment in Nigeria.
          </p>
          <p>
            Founded with a clear belief that sport can be both a business and
            a movement, Showtime Flag brings together athletes, fans, brands,
            schools, communities, and media through organized leagues,
            tournaments, training programs, and high-quality sporting
            experiences.
          </p>
          <p>
            At the heart of Showtime Flag is a simple mission: to make flag
            football accessible, aspirational, and commercially viable.
          </p>
          <p className="font-bold text-sffl-navy dark:text-white text-lg mt-6 pt-6 border-t border-gray-200 dark:border-white/20">
            We are building more than a league. We are building an ecosystem
            where athletes can compete, brands can connect with youth culture,
            and communities can experience sport in a fresh, energetic, and
            inclusive way.
          </p>
        </div>
      </section>

      {/* Incubator Program */}
      <section className="bg-linear-to-r from-gray-900 to-sffl-navy text-white p-5 sm:p-8 md:p-10">
        <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80 mb-4">
          <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
          Development
        </p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase mb-6 wrap-break-word">
          THE SHOWTIME INCUBATOR PROGRAM
        </h2>

        <div className="space-y-6 text-base sm:text-lg text-gray-200 lg:w-3/4">
          <p className="font-semibold text-lg sm:text-xl text-white">
            The Showtime Incubator is our talent and ecosystem development
            platform.
          </p>
          <p>
            Designed to identify, train, and elevate athletes and future
            leaders within the sport, the Incubator creates a structured
            pathway for growth and exposure.
          </p>
          <p>
            Through performance camps, strategic training programs,
            mentorship, and media visibility initiatives, the Incubator
            ensures a consistent pipeline of high-level talent operating under
            professional standards.
          </p>
          <p className="border-l-4 border-sffl-red pl-4 py-2 mt-8 font-medium">
            It reflects our long-term commitment to sustaining excellence,
            institutional integrity, and the continued growth of co-ed flag
            football.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <FAQSection />
    </div>
  );
};
