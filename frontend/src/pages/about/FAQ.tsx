import { useState } from 'react';

interface FAQItem {
    question: string;
    answer: string;
}

const faqs: FAQItem[] = [
    {
        question: "How do I register my team for the league?",
        answer: "Team registration opens at the beginning of each season. Contact the league office or check our social media for registration announcements. You'll need to submit a team roster, registration fee, and signed waivers for all players."
    },
    {
        question: "What equipment do I need to play?",
        answer: "Each player needs a mouthguard and cleats (no metal spikes). The league provides flags and game balls. We recommend wearing athletic clothing appropriate for outdoor activity."
    },
    {
        question: "Are there different divisions or skill levels?",
        answer: "Yes, SFFL has multiple divisions based on skill level and experience. We offer competitive and recreational divisions to ensure balanced and enjoyable games for all participants."
    },
    {
        question: "What is the season schedule?",
        answer: "The regular season typically runs for 8-10 weeks, followed by playoffs. Games are held on weekends at Showtime Arena. The full schedule is posted on our website once the season begins."
    },
    {
        question: "How are referees assigned to games?",
        answer: "All games are officiated by certified SFFL referees. Referee assignments are made by the league office to ensure impartial and professional officiating."
    },
    {
        question: "What happens if a game is postponed due to weather?",
        answer: "The Commissioner will make weather-related decisions and notify all teams via text/WhatsApp and social media. Postponed games will be rescheduled to a later date."
    },
    {
        question: "Can I watch games as a spectator?",
        answer: "Absolutely! All SFFL games are open to fans and spectators. Entry is free, and we encourage you to come support your favorite teams."
    },
    {
        question: "How do fines and infractions work?",
        answer: "Players and teams are expected to uphold league standards of conduct. Violations of rules or sportsmanship may result in fines, suspensions, or other penalties as outlined in the league byelaws."
    }
];

export const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">FREQUENTLY ASKED QUESTIONS</h1>
                <p className="text-gray-300 mt-2">Your questions answered</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md">
                <p className="text-gray-600 mb-6">
                    Have a question about SFFL? Check our FAQ below. If you don't find your answer,
                    feel free to contact us directly.
                </p>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleFAQ(index)}
                                className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 transition text-left"
                            >
                                <span className="font-bold text-sffl-navy pr-4">{faq.question}</span>
                                <span className="text-sffl-red text-2xl font-bold flex-shrink-0">
                                    {openIndex === index ? '−' : '+'}
                                </span>
                            </button>
                            {openIndex === index && (
                                <div className="p-5 bg-white border-t border-gray-200">
                                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="bg-sffl-navy text-white p-6 rounded-xl mt-8">
                    <h3 className="font-bold text-xl mb-2">Still have questions?</h3>
                    <p className="text-gray-300 mb-4">
                        Contact us at <a href="mailto:info@sffl.football" className="text-sffl-red hover:underline">info@sffl.football</a>
                    </p>
                </div>
            </section>
        </div>
    );
};
