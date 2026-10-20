import { CheckIcon } from "@heroicons/react/24/outline";
import { CopyableEmail } from "../../components";

export const Sponsorships = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      <section className="p-5 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          Sponsorships
        </h2>

        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          <p className="font-medium text-lg sm:text-xl text-sffl-navy dark:text-blue-400">
            Showtime offers premium partnership opportunities across live
            events, digital platforms, media integration, and community
            development initiatives.
          </p>
          <p>
            As The Standard of Co-Ed Flag Football, we provide more than brand
            visibility. What we offer is cultural positioning within a
            fast-growing, youth-forward sports ecosystem.
          </p>

          <div className="border border-gray-200 dark:border-gray-700 border-t-4 border-t-sffl-red bg-white dark:bg-gray-800 p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mb-4">
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

          <p className="font-bold text-lg text-sffl-navy dark:text-white mt-6 pt-6 border-t border-gray-200 dark:border-white/20">
            Showtime is where brands align with competition, culture, and
            credibility.
          </p>
          <div className="flex justify-center mt-6">
            <CopyableEmail
              email="showtime@sffl.football"
              label="Request Deck at:"
              className="bg-gray-100 dark:bg-gray-800 text-sffl-navy dark:text-white px-4 sm:px-6 py-2 justify-center text-sm border border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
