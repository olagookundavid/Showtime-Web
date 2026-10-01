import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mt-8 md:mt-12 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 md:p-10 rounded-3xl border border-gray-100 dark:border-gray-700">
      <div className="text-center mb-6 md:mb-10">
        <h2 className="text-2xl sm:text-4xl font-black text-sffl-navy dark:text-white italic wrap-break-word">
          FREQUENTLY ASKED QUESTIONS
        </h2>
        <p className="text-gray-500 mt-2">
          Everything you need to know about Showtime Flag Football.
        </p>
      </div>

      <div className="space-y-4 max-w-4xl mx-auto">
        {topFaqs.map((faq, index) => (
          <div
            key={index}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${openIndex === index ? "border-sffl-red" : "border-gray-200 dark:border-gray-700"} overflow-hidden transition-all duration-300`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              aria-expanded={openIndex === index}
              className="w-full min-h-11 text-left px-4 sm:px-6 py-4 flex items-center justify-between gap-3 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span
                className={`font-bold text-base sm:text-lg min-w-0 ${openIndex === index ? "text-sffl-red" : "text-sffl-navy dark:text-gray-200"}`}
              >
                {faq.q}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className={`w-6 h-6 shrink-0 transform transition-transform duration-300 ${openIndex === index ? "rotate-180 text-sffl-red" : "text-gray-400"}`}
              />
            </button>

            {/* Grows to the answer's own height, so a long answer is never cut off. */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${openIndex === index ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 leading-relaxed text-base">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/about/faq"
          className="inline-flex items-center gap-2 min-h-11 bg-white dark:bg-gray-800 text-sffl-navy dark:text-white font-bold py-3 px-8 sm:px-10 rounded-full border border-gray-200 dark:border-gray-600 hover:border-sffl-red hover:text-sffl-red transition transform hover:-translate-y-1 shadow-sm hover:shadow-lg"
        >
          View All FAQs
          <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};
