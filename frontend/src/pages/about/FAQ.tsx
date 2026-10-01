import { useState, type ComponentType, type SVGProps } from "react";
import {
  ChevronDownIcon,
  RocketLaunchIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { CopyableEmail } from "../../components/common/CopyableEmail";
import { FootballIcon } from "../../components/icons/FootballIcon";
import { PitchIcon } from "../../components/icons/PitchIcon";

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
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  faqs: { q: string; a: string }[];
};

const faqCategories: FaqCategory[] = [
  {
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
    title: "Own A Team",
    icon: PitchIcon,
    faqs: [
      {
        q: "How can I own a team in Showtime Flag Football?",
        a: "We welcome passionate individuals and organisations who want to be part of the Showtime franchise. Team ownership opportunities are available on a case-by-case basis and are subject to league approval. To express your interest or get more information, please reach out to us directly at showtime@showtimeflag.football and a member of our team will get back to you.",
      },
      {
        q: "What does owning a team involve?",
        a: "Team owners are responsible for managing their franchise within the Showtime framework — including player recruitment, team operations, and upholding league standards. Full guidance is provided upon approval. Contact us at showtime@showtimeflag.football to start the conversation.",
      },
      {
        q: "Is there a cost to owning a team?",
        a: "Ownership structures vary and are discussed directly with prospective owners. For detailed information on fees, obligations, and benefits, contact our team at showtime@showtimeflag.football.",
      },
    ],
  },
];

// Reusable FAQ Item Component
const FAQItem = ({
  faq,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${isOpen ? "border-sffl-red" : "border-gray-200 dark:border-gray-700"} overflow-hidden transition-all duration-300`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-11 text-left px-4 sm:px-6 py-4 flex items-center justify-between gap-3 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span
          className={`font-bold text-base sm:text-lg min-w-0 ${isOpen ? "text-sffl-red" : "text-sffl-navy dark:text-gray-200"}`}
        >
          {faq.q}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`w-6 h-6 shrink-0 transform transition-transform duration-300 ${isOpen ? "rotate-180 text-sffl-red" : "text-gray-400"}`}
        />
      </button>
      {/* Grows to the answer's own height, so a long answer is never cut off. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 leading-relaxed text-base wrap-break-word">
            {faq.a}
          </p>
        </div>
      </div>
    </div>
  );
};

export const FAQ = () => {
  // Keep track of which question is open globally using a combination of categoryIndex and questionIndex
  const [openKey, setOpenKey] = useState<string | null>(null);

  const handleToggle = (catIndex: number, qIndex: number) => {
    const key = `${catIndex}-${qIndex}`;
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="bg-linear-to-r from-sffl-navy to-blue-900 text-white p-6 md:p-12 rounded-3xl shadow-2xl text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10">
          <span className="inline-block bg-sffl-red text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 mt-2">
            Help Center
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic tracking-tighter mb-4 text-white wrap-break-word">
            FREQUENTLY ASKED QUESTIONS
          </h1>
          <p className="text-base sm:text-xl text-gray-200 font-medium">
            Everything you need to know about Showtime Flag Football
          </p>
        </div>
      </div>

      <div className="space-y-8 md:space-y-12">
        {faqCategories.map((category, catIndex) => (
          <section key={catIndex} className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-4 md:mb-6 border-b-2 border-gray-100 dark:border-gray-800 pb-2">
              <category.icon
                className="w-7 h-7 md:w-8 md:h-8 shrink-0 text-sffl-red"
                aria-hidden="true"
              />
              <h2 className="min-w-0 text-xl sm:text-2xl md:text-3xl font-black italic tracking-tight text-sffl-navy dark:text-white">
                {category.title}
              </h2>
            </div>
            <div className="space-y-4">
              {category.faqs.map((faq, qIndex) => (
                <FAQItem
                  key={qIndex}
                  faq={faq}
                  isOpen={openKey === `${catIndex}-${qIndex}`}
                  onToggle={() => handleToggle(catIndex, qIndex)}
                />
              ))}
            </div>
          </section>
        ))}
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
            email="showtime@showtimeflag.football"
            label="Contact Support:"
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sffl-navy dark:text-white px-4 sm:px-6 py-2 rounded-3xl sm:rounded-full justify-center text-sm border border-gray-200 dark:border-gray-700 shadow-sm transition"
          />
        </div>
      </div>
    </div>
  );
};
