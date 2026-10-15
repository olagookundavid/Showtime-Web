import { ArrowRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { ButtonLink } from "../../components";

const topFaqs = [
  {
    q: "What is flag football?",
    a: "Flag football is a non-contact version of American football where tackles are replaced by the removal of a flag attached to the ball carrier. The game is fast-paced, strategic, and highly competitive.",
  },
  {
    q: "Is Showtime co-ed?",
    a: "Yes. Showtime is structured as a co-ed league, with men and women competing together at the highest level.",
  },
  {
    q: "When and where are games held?",
    a: "Games are held every Sunday during the season at Showtime Arena, Lekki.",
  },
];

export const FAQSection = () => {
  return (
    <section className="mt-8 md:mt-12 p-4 sm:p-6 md:p-10">
      <div className="mb-6 md:mb-10 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
          Help Center
        </p>
        <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
          Frequently asked questions
        </h2>
        <p className="text-gray-500">
          Everything you need to know about Showtime Flag Football.
        </p>
      </div>

      <div className="max-w-4xl divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {topFaqs.map((faq) => (
          <details key={faq.q} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-sffl-navy [&::-webkit-details-marker]:hidden dark:text-white">
              {faq.q}
              <ChevronDownIcon
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-4 text-sm text-gray-600 dark:text-gray-300">{faq.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-10">
        <ButtonLink
          to="/about/faq"
          variant="outline"
          shape="square"
          icon={ArrowRightIcon}
          iconPosition="right"
        >
          View All FAQs
        </ButtonLink>
      </div>
    </section>
  );
};
