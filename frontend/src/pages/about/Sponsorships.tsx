import { CheckIcon } from "@heroicons/react/24/outline";
import { CopyableEmail } from "../../components/common/CopyableEmail";

export const Sponsorships = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      <div className="bg-sffl-navy text-white p-5 sm:p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-sffl-red/30 to-sffl-navy/40" />
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic tracking-tighter relative z-10 wrap-break-word">
          PARTNERSHIPS & SPONSORSHIPS
        </h1>
      </div>

      <section className="bg-white dark:bg-gray-800 p-5 sm:p-8 md:p-10 rounded-3xl shadow-xl relative overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white mb-6">
          SPONSORSHIPS
        </h2>

        <div className="prose sm:prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <p className="font-medium text-lg sm:text-xl text-sffl-navy dark:text-blue-400 mb-6">
            Showtime offers premium partnership opportunities across live
            events, digital platforms, media integration, and community
            development initiatives.
          </p>
          <p className="mb-8">
            As The Standard of Co-Ed Flag Football, we provide more than brand
            visibility. What we offer is cultural positioning within a
            fast-growing, youth-forward sports ecosystem.
          </p>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-8 rounded-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-sffl-navy dark:text-white mb-4">
              Partnership opportunities include:
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 list-none p-0 m-0">
              {[
                "Title Sponsorship",
                "Season Partnerships",
                "Game-Day Activations",
                "Digital & Media Integration",
                "Product Placement & On-Site Experience",
                "Community & Development Program Sponsorship",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 m-0 p-0 text-base font-semibold"
                >
                  <CheckIcon
                    className="w-5 h-5 mt-0.5 shrink-0 text-sffl-red"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="font-black text-lg sm:text-xl text-center text-sffl-navy dark:text-white mt-8 italic">
            Showtime is where brands align with competition, culture, and
            credibility.
          </p>
          <div className="flex justify-center mt-6">
            <CopyableEmail
              email="showtime@showtimeflag.football"
              label="Request Deck at:"
              className="bg-gray-100 dark:bg-gray-800 text-sffl-navy dark:text-white px-4 sm:px-6 py-2 rounded-3xl sm:rounded-full justify-center text-sm border border-gray-200 dark:border-gray-700 shadow-sm"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
