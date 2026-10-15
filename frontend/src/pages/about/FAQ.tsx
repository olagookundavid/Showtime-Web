import { type ComponentType, type SVGProps } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDownIcon,
  RocketLaunchIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import {
  CopyableEmail,
  FootballIcon,
  PitchIcon,
  navLinkClass,
} from "../../components";

// Heroicons has no handshake, so the partnerships mark is drawn in their
// outline style: two forearms meeting in a clasp.
const HandshakeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M1.5 11.25 5.25 7.5h3l1.5 1.13" />
    <path d="M22.5 11.25 18.75 7.5H15l-4.72 3.94a1.5 1.5 0 0 0 1.97 2.26l2.25-1.7" />
    <path d="m18.75 12.75-4.97 4.97a1.5 1.5 0 0 1-2.12 0L5.25 11.25" />
    <path d="m9.19 15.19 1.31 1.31M7.31 13.31l1.32 1.32" />
  </svg>
);

type FaqCategory = {
  id: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  faqs: { q: string; a: string }[];
};

const faqCategories: FaqCategory[] = [
  {
    id: "about-sffl",
    title: "About Showtime Flag Football",
    icon: FootballIcon,
    faqs: [
      {
        q: "What is flag football?",
        a: "Flag football is a non-contact version of American football where tackles are replaced by the removal of a flag attached to the ball carrier. The game is fast-paced, strategic, and highly competitive.",
      },
      {
        q: "Is Showtime co-ed?",
        a: "Yes. Showtime is structured as a co-ed league, with men and women competing together at the highest level.",
      },
      {
        q: "How many teams compete in Showtime each season?",
        a: "The number of teams may vary by season. Each team qualifies based on league requirements and operates within the official competitive structure established by Showtime.",
      },
      {
        q: "How long is a Showtime season?",
        a: "A Showtime season runs across thirteen Sundays, culminating in playoffs and a championship finale.",
      },
      {
        q: "How competitive is the league?",
        a: "Showtime operates at an elite and professional level. Teams compete within structured rankings, and performance standards are enforced throughout the season.",
      },
      {
        q: "Are referees and officials certified?",
        a: "Yes. Showtime games are governed by qualified officials who uphold league integrity and enforce standardized rules of play.",
      },
      {
        q: "How are champions determined?",
        a: "Champions are determined through structured playoff systems based on season rankings and performance outcomes leading to the Showtime Bowl.",
      },
      {
        q: "What makes Showtime different from other flag football competitions?",
        a: "Showtime combines elite co-ed competition with curated spectacle. We are structured, performance-driven, and intentionally staged defining the highest standard in the format.",
      },
    ],
  },
  {
    id: "games-attendance",
    title: "Games & Attendance",
    icon: TicketIcon,
    faqs: [
      {
        q: "When and where are games held?",
        a: "Games are held every Sunday during the season at Showtime Arena, Lekki.",
      },
      {
        q: "How can I attend?",
        a: "Tickets can be purchased online before game day. Availability may be limited based on capacity.",
      },
      {
        q: "Is Showtime suitable for first-time sports viewers?",
        a: "Yes. Whether you’re a longtime sports fan or new to flag football, the game-day experience is designed to be immersive, engaging, and easy to follow.",
      },
      {
        q: "Are there food and beverage options at games?",
        a: "Yes. Showtime game days feature curated food, drink, and lounge experiences designed to enhance the overall atmosphere.",
      },
      {
        q: "Is Showtime family-friendly?",
        a: "Yes. Showtime is inclusive and welcoming to a wide range of audiences, while maintaining a high-energy competitive atmosphere.",
      },
      {
        q: "How can I stay updated on the season schedule?",
        a: "Season schedules, match fixtures, and league updates are released on our official digital platforms and website.",
      },
    ],
  },
  {
    id: "sponsorships",
    title: "Sponsorships & Partnerships",
    icon: HandshakeIcon,
    faqs: [
      {
        q: "How can my brand partner with Showtime?",
        a: "Organizations interested in sponsorship and partnership opportunities can contact our team to receive a sponsorship proposal and partnership deck.",
      },
      {
        q: "Can businesses host corporate outings at Showtime?",
        a: "Yes. Corporate hospitality packages and group bookings are available for brands and organizations seeking premium group experiences.",
      },
      {
        q: "Is there media coverage of Showtime games?",
        a: "Yes. Games are documented through digital media, live coverage, and post-game content distributed across official platforms.",
      },
      {
        q: "Does Showtime collaborate with other cities or regions?",
        a: "Showtime is designed to be scalable and open to strategic collaborations that align with our institutional standards.",
      },
    ],
  },
  {
    id: "incubator",
    title: "Players & Development (Incubator)",
    icon: RocketLaunchIcon,
    faqs: [
      {
        q: "How do I join the Showtime Incubator?",
        a: "Athletes join the Showtime Incubator through our development pipeline. Players are identified through initiatives such as Showtime Streetz, where we scout raw talent across different parts of the country, or through participation in Showtime Pro, our intensive training program. Athletes may be scouted directly from Showtime Streets or enroll in Showtime Pro training. Following evaluation and performance assessment, selected athletes are added to one of the Incubator teams.",
      },
      {
        q: "What is Showtime Streetz?",
        a: "Showtime Streetz is our scouting initiative. Through this program, we visit different parts of the country to identify and recruit raw athletic talent with the potential to compete at the highest level.",
      },
      {
        q: "What is Showtime Pro?",
        a: "Showtime Pro is our intensive training and development program designed to elevate athletes through structured coaching, performance evaluation, and competitive preparation. Even athletes who are not scouted through Showtime Streetz can join Showtime Pro. Outstanding performers may be selected to join the Incubator teams.",
      },
      {
        q: "Does Showtime support youth or grassroots development?",
        a: "Yes. Through initiatives like the Showtime Streetz and Showtime Incubator program, we invest in structured development pathways for emerging talent.",
      },
      {
        q: "Can players transfer between teams?",
        a: "Player eligibility, transfers, and roster management are governed by official league regulations to ensure competitive balance.",
      },
    ],
  },
  {
    id: "own-a-team",
    title: "Own A Team",
    icon: PitchIcon,
    faqs: [
      {
        q: "How can I own a team in Showtime Flag Football?",
        a: "We welcome passionate individuals and organisations who want to be part of the Showtime franchise. Team ownership opportunities are available on a case-by-case basis and are subject to league approval. To express your interest or get more information, please reach out to us directly at showtime@sffl.football and a member of our team will get back to you.",
      },
      {
        q: "What does owning a team involve?",
        a: "Team owners are responsible for managing their franchise within the Showtime framework — including player recruitment, team operations, and upholding league standards. Full guidance is provided upon approval. Contact us at showtime@sffl.football to start the conversation.",
      },
      {
        q: "Is there a cost to owning a team?",
        a: "Ownership structures vary and are discussed directly with prospective owners. For detailed information on fees, obligations, and benefits, contact our team at showtime@sffl.football.",
      },
    ],
  },
];

export const FAQ = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const activeCategory =
    faqCategories.find((c) => c.id === categoryParam) ?? faqCategories[0];

  const selectCategory = (id: string) => {
    setSearchParams({ category: id }, { replace: true });
  };

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="lg:grid lg:grid-cols-[290px_1fr] lg:gap-10 lg:items-start">
        <div
          role="tablist"
          aria-label="FAQ categories"
          className="flex flex-wrap gap-x-6 gap-y-3 border-b border-gray-200 pb-4 text-xs font-bold uppercase tracking-wide lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6 dark:border-gray-700"
        >
          {faqCategories.map((category) => {
            const active = category.id === activeCategory.id;
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${navLinkClass(active, "text-sffl-navy dark:text-white")} gap-2`}
                onClick={() => selectCategory(category.id)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {category.title}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="mt-6 min-w-0 lg:mt-0">
          <h2 className="mb-4 text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
            {activeCategory.title}
          </h2>
          <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {activeCategory.faqs.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-sffl-navy [&::-webkit-details-marker]:hidden dark:text-white">
                  {faq.q}
                  <ChevronDownIcon
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-4 text-sm text-gray-600 dark:text-gray-300 wrap-break-word">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center pt-8 border-t border-gray-200 dark:border-gray-800 max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold text-sffl-navy dark:text-white mb-2">
          Still have questions?
        </h3>
        <p className="text-gray-500 mb-6">
          Can't find the answer you're looking for? Reach out to our team.
        </p>
        <div className="flex justify-center">
          <CopyableEmail
            email="showtime@sffl.football"
            label="Contact Support:"
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sffl-navy dark:text-white px-4 sm:px-6 py-2 rounded-none justify-center text-sm border border-gray-200 dark:border-gray-700 transition"
          />
        </div>
      </div>
    </div>
  );
};
