import { useState } from 'react';
import { CopyableEmail } from '../../components/common/CopyableEmail';

const faqCategories = [
    {
        title: "About Showtime Flag Football",
        icon: "🏈",
        faqs: [
            {
                q: "What is flag football?",
                a: "Flag football is a non-contact version of American football where tackles are replaced by the removal of a flag attached to the ball carrier. The game is fast-paced, strategic, and highly competitive."
            },
            {
                q: "Is Showtime co-ed?",
                a: "Yes. Showtime is structured as a co-ed league, with men and women competing together at the highest level."
            },
            {
                q: "How many teams compete in Showtime each season?",
                a: "The number of teams may vary by season. Each team qualifies based on league requirements and operates within the official competitive structure established by Showtime."
            },
            {
                q: "How long is a Showtime season?",
                a: "A Showtime season runs across thirteen Sundays, culminating in playoffs and a championship finale."
            },
            {
                q: "How competitive is the league?",
                a: "Showtime operates at an elite and professional level. Teams compete within structured rankings, and performance standards are enforced throughout the season."
            },
            {
                q: "Are referees and officials certified?",
                a: "Yes. Showtime games are governed by qualified officials who uphold league integrity and enforce standardized rules of play."
            },
            {
                q: "How are champions determined?",
                a: "Champions are determined through structured playoff systems based on season rankings and performance outcomes leading to the Showtime Bowl."
            },
            {
                q: "What makes Showtime different from other flag football competitions?",
                a: "Showtime combines elite co-ed competition with curated spectacle. We are structured, performance-driven, and intentionally staged defining the highest standard in the format."
            }
        ]
    },
    {
        title: "Games & Attendance",
        icon: "🎟️",
        faqs: [
            {
                q: "When and where are games held?",
                a: "Games are held every Sunday during the season at Showtime Arena, Lekki."
            },
            {
                q: "How can I attend?",
                a: "Tickets can be purchased online before game day. Availability may be limited based on capacity."
            },
            {
                q: "Is Showtime suitable for first-time sports viewers?",
                a: "Yes. Whether you’re a longtime sports fan or new to flag football, the game-day experience is designed to be immersive, engaging, and easy to follow."
            },
            {
                q: "Are there food and beverage options at games?",
                a: "Yes. Showtime game days feature curated food, drink, and lounge experiences designed to enhance the overall atmosphere."
            },
            {
                q: "Is Showtime family-friendly?",
                a: "Yes. Showtime is inclusive and welcoming to a wide range of audiences, while maintaining a high-energy competitive atmosphere."
            },
            {
                q: "How can I stay updated on the season schedule?",
                a: "Season schedules, match fixtures, and league updates are released on our official digital platforms and website."
            }
        ]
    },
    {
        title: "Sponsorships & Partnerships",
        icon: "🤝",
        faqs: [
            {
                q: "How can my brand partner with Showtime?",
                a: "Organizations interested in sponsorship and partnership opportunities can contact our team to receive a sponsorship proposal and partnership deck."
            },
            {
                q: "Can businesses host corporate outings at Showtime?",
                a: "Yes. Corporate hospitality packages and group bookings are available for brands and organizations seeking premium group experiences."
            },
            {
                q: "Is there media coverage of Showtime games?",
                a: "Yes. Games are documented through digital media, live coverage, and post-game content distributed across official platforms."
            },
            {
                q: "Does Showtime collaborate with other cities or regions?",
                a: "Showtime is designed to be scalable and open to strategic collaborations that align with our institutional standards."
            }
        ]
    },
    {
        title: "Players & Development (Incubator)",
        icon: "🚀",
        faqs: [
            {
                q: "How do I join the Showtime Incubator?",
                a: "Athletes join the Showtime Incubator through our development pipeline. Players are identified through initiatives such as Showtime Streetz, where we scout raw talent across different parts of the country, or through participation in Showtime Pro, our intensive training program. Athletes may be scouted directly from Showtime Streets or enroll in Showtime Pro training. Following evaluation and performance assessment, selected athletes are added to one of the Incubator teams."
            },
            {
                q: "What is Showtime Streetz?",
                a: "Showtime Streetz is our scouting initiative. Through this program, we visit different parts of the country to identify and recruit raw athletic talent with the potential to compete at the highest level."
            },
            {
                q: "What is Showtime Pro?",
                a: "Showtime Pro is our intensive training and development program designed to elevate athletes through structured coaching, performance evaluation, and competitive preparation. Even athletes who are not scouted through Showtime Streetz can join Showtime Pro. Outstanding performers may be selected to join the Incubator teams."
            },
            {
                q: "Does Showtime support youth or grassroots development?",
                a: "Yes. Through initiatives like the Showtime Streetz and Showtime Incubator program, we invest in structured development pathways for emerging talent."
            },
            {
                q: "Can players transfer between teams?",
                a: "Player eligibility, transfers, and roster management are governed by official league regulations to ensure competitive balance."
            }
        ]
    }
];

// Reusable FAQ Item Component
const FAQItem = ({ faq, isOpen, onToggle }: { faq: { q: string, a: string }, isOpen: boolean, onToggle: () => void }) => {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${isOpen ? 'border-sffl-red' : 'border-gray-200 dark:border-gray-700'} overflow-hidden transition-all duration-300`}>
            <button
                onClick={onToggle}
                className="w-full text-left px-6 py-4 flex items-center justify-between focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                aria-expanded={isOpen}
            >
                <span className={`font-bold pr-8 text-lg ${isOpen ? 'text-sffl-red' : 'text-sffl-navy dark:text-gray-200'}`}>
                    {faq.q}
                </span>
                <span className={`text-2xl transform transition-transform duration-300 ${isOpen ? 'rotate-180 text-sffl-red' : 'text-gray-400'}`}>
                    ↓
                </span>
            </button>
            <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] py-4 border-t border-gray-100 dark:border-gray-700' : 'max-h-0 py-0'}`}>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base">
                    {faq.a}
                </p>
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
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8 pb-16">
            <div className="bg-gradient-to-r from-sffl-navy to-blue-900 text-white p-12 rounded-3xl shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
                <div className="relative z-10">
                    <span className="inline-block bg-sffl-red text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 mt-2">Help Center</span>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-4 text-white">FREQUENTLY ASKED QUESTIONS</h1>
                    <p className="text-xl text-gray-200 font-medium">Everything you need to know about Showtime Flag Football</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto space-y-12">
                {faqCategories.map((category, catIndex) => (
                    <section key={catIndex} className="scroll-mt-24">
                        <div className="flex items-center gap-3 mb-6 border-b-2 border-gray-100 dark:border-gray-800 pb-2">
                            <span className="text-3xl">{category.icon}</span>
                            <h2 className="text-3xl font-black italic tracking-tight text-sffl-navy dark:text-white">{category.title}</h2>
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
                <h3 className="text-2xl font-bold text-sffl-navy dark:text-white mb-2">Still have questions?</h3>
                <p className="text-gray-500 mb-6">Can't find the answer you're looking for? Reach out to our team.</p>
                <div className="flex justify-center">
                    <CopyableEmail email="showtime@sffl.football" label="Contact Support:" className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sffl-navy dark:text-white px-6 py-3 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm transition" />
                </div>
            </div>
        </div>
    );
};
