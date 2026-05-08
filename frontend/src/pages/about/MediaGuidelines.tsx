import { useState } from 'react';
import { CopyableEmail } from '../../components/common/CopyableEmail';

interface GuidelineSection {
    id: number;
    title: string;
    content: React.ReactNode;
}

export const MediaGuidelines = () => {
    const [openSection, setOpenSection] = useState<number | null>(null);

    const toggleSection = (id: number) => {
        setOpenSection(openSection === id ? null : id);
    };

    const sections: GuidelineSection[] = [
        {
            id: 1,
            title: "1. Application",
            content: (
                <div className="space-y-4">
                    <p>
                        Registration for accreditation is mandatory for individuals who require media access at the League games and events. All media members and content creators must apply for single-game day credentials and media access by submitting the Showtime Flag Football League Media Accreditation Application Form no later than <strong>48 hours from game day</strong>.
                    </p>
                    <p>
                        All accreditation applications will be reviewed by the League and the League reserves the right to deny accreditation applications without cause.
                    </p>
                    <p>
                        Journalists who receive accreditations must be on assignment for a reputable media organization with a reputation for covering sporting events. Content creators will be required to submit a content plan before accreditation. If a content creator is working on behalf of multiple media outlets or on behalf of multiple league teams, they must disclose this in their application.
                    </p>
                </div>
            )
        },
        {
            id: 2,
            title: "2. Media Accreditation",
            content: (
                <div className="space-y-4">
                    <p>
                        All accredited members of the media and content creators must wear their Media Accreditation Pass and a media bib at all times when working at the League games or events. The media bib is the property of the League and shall be provided to members of the media and content creators at every game day.
                    </p>
                    <p>
                        All media bibs must be returned to the league officials at the end of each game day or the league event.
                    </p>
                    <p>
                        Accreditations must always be visible during the game days or events. Each accreditation is issued specifically for the media member or content creator who was accepted through the accreditation process. Accreditations may not be transferred or loaned to another person for any reason. Failure to adhere to this can result in the loss of accreditations for all parties involved. Accreditations may be revoked at any time without cause.
                    </p>
                </div>
            )
        },
        {
            id: 3,
            title: "3. Accreditation Usage",
            content: (
                <div className="space-y-4">
                    <p>
                        Accredited members of the media and content creators will receive admission to game days and league events, access to media work areas and any spaces designated for media in the venue. Misuse of the media accreditation will result in the immediate loss of the accreditation, removal from the media areas and the possible loss of accreditation privileges for future events.
                    </p>
                </div>
            )
        },
        {
            id: 4,
            title: "4. Content Restrictions",
            content: (
                <div className="space-y-4">
                    <p><strong>Game Footage:</strong> Game footage to be used in any single piece of content shall not exceed 10 minutes in length.</p>
                    <p><strong>Coach and Player Interviews:</strong> Interviews with coaching staff and/or players are permitted only in designated areas and must not interfere with their preparation or recovery.</p>
                    <p><strong>Branding:</strong> All content must include the Showtime Flag Football League logo and credit the league appropriately.</p>
                    <p><strong>Prohibited Content:</strong> Content must not include any discriminatory, offensive, or inappropriate material.</p>
                </div>
            )
        },
        {
            id: 5,
            title: "5. Equipment and Setup",
            content: (
                <div className="space-y-4">
                    <p><strong>Permitted Equipment:</strong> Handheld cameras, tripods, and mobile devices are allowed. Drone use is strictly prohibited without prior written consent.</p>
                    <p><strong>Designated Areas:</strong> Content creators must stay within designated media areas and not obstruct the view of spectators or the operation of the game.</p>
                    <p><strong>Audio Equipment:</strong> Microphones and other audio recording devices must not interfere with game operations.</p>
                </div>
            )
        },
        {
            id: 6,
            title: "6. Conduct",
            content: (
                <div className="space-y-4">
                    <p><strong>Professional Behavior:</strong> Accredited members of the media and content creators must always conduct themselves professionally and behave in an orderly manner. All media members and content creators must respect the work environment of their colleagues by maintaining a quiet and professional atmosphere. Any disruptive, abusive or threatening behavior will not be accepted and may result in immediate revocation of media accreditation.</p>
                    <p><strong>Respect for Participants:</strong> Respect the privacy and personal space of players, coaches, and officials. Do not engage in aggressive questioning or behavior.</p>
                </div>
            )
        },
        {
            id: 7,
            title: "7. Content Use and Distribution",
            content: (
                <div className="space-y-4">
                    <p>
                        The league has exclusive rights to all league footage and requires all footage to be submitted to the League's media office within 36 hours of capture. The league may also require accredited media personnel to be connected to the League's gameday media operations.
                    </p>
                    <p>
                        Content captured shall be used for only non-commercial editorial purposes unless expressly permitted by the Showtime Flag Football League.
                    </p>
                    <p className="font-bold">The league reserves the right to:</p>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                        <li>Stop the use of all content if such content does not represent the League in a manner deemed proper by the league;</li>
                        <li>Request for mandatory submission of content prior to publishing;</li>
                        <li>Restrict the right to use the content in certain platforms or mediums;</li>
                        <li>Reduce or extend the embargo on publication of League footage.</li>
                    </ul>
                    <p>
                        <strong>Distribution Platforms:</strong> Content creators may distribute their content on personal websites, blogs, and social media channels. Content must not be sold or used in paid advertising without prior approval.
                    </p>
                    <p>
                        All accredited media and content creators agree that they shall not distribute, broadcast, publish or post any content captured or created at the league games or league events while the games or event is in progress. Content captured or created shall only be published or posted by the media and content creators upon the expiration of <strong>36 hours</strong> after any game day or the league event except with the permission of the League.
                    </p>
                </div>
            )
        },
        {
            id: 8,
            title: "8. Legal Compliance",
            content: (
                <div className="space-y-4">
                    <p>
                        <strong>Copyright Laws:</strong> Showtime Flag Football League on behalf of SFFL, is the exclusive copyright holder in and to all Footage of the Showtime Flag Football League (the League Footage). League Footage is defined as league game footage, as well as all league-controlled events (i.e., League Draft, League Combine, etc.).
                    </p>
                    <p>
                        Any use of League-controlled footage requires the express written consent of the League (in the form of a contract) and must be used in compliance with all terms, requirements and restrictions stated therein.
                    </p>
                    <p>
                        For purposes of this framework, &ldquo;League game footage&rdquo; shall include any footage taken of events at any and all game days and events from the period three hours prior to kickoff of a league game to two hours after the game has ended; and ending upon the completion of the trophy presentation; and the day of the Showtime Bowl.
                    </p>
                    <p>
                        <strong>Grant of Rights:</strong> Subject to the terms of this framework, the League shall grant to the accredited person the rights to capture, publish or post footage from any game day or league events provided the use of such footage is in line with the purpose of the accreditation granted by the League.
                    </p>
                    <p>
                        <strong>Liability:</strong> The Showtime Flag Football League is not liable for any injuries, damage, or loss of equipment incurred by content creators during the event and the media and content creators hereby release the League from any and all liability arising in connection with attending the league games or events.
                    </p>
                </div>
            )
        },
        {
            id: 9,
            title: "9. Revocation of Access",
            content: (
                <div className="space-y-4">
                    <p><strong>Violation of Guidelines:</strong> Any violation of these guidelines may result in the immediate revocation of media access and removal from the event.</p>
                    <p><strong>Discretionary Powers:</strong> The Showtime Flag Football League reserves the right to revoke media access at its discretion.</p>
                </div>
            )
        }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8 pb-16">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
                <div className="text-center md:text-left z-10">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">Media Accreditation</h1>
                    <p className="text-xl text-gray-300 mt-2 font-semibold tracking-wider uppercase">Guidelines for Content Creators & Journalists</p>
                </div>
            </div>

            {/* Purpose Section */}
            <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border-l-8 border-sffl-red">
                <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-sffl-red">📌</span> PURPOSE
                </h2>
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium space-y-4">
                    <p>
                        Showtime Flag Football League strives to maintain a professional work environment for journalists covering league games and events. This Media Accreditation framework sets the required operating guidelines for all accredited members of the media and content creators.
                    </p>
                    <p>
                        Members of the media and content creators are required to act respectfully towards colleagues, athletes, coaching staff, organisers, and volunteers. All coverage must adhere to standard international media and journalism ethics principles.
                    </p>
                </div>
            </section>

            {/* Accordion Framework */}
            <section className="space-y-4">
                <h2 className="text-3xl font-black text-sffl-navy dark:text-white mb-6">MEDIA ACCREDITATION FRAMEWORK</h2>
                {sections.map((section) => (
                    <div
                        key={section.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden"
                    >
                        <button
                            className="w-full flex justify-between items-center px-6 py-4 text-left font-bold text-lg text-sffl-navy dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => toggleSection(section.id)}
                        >
                            <span>{section.title}</span>
                            <span className={`text-2xl transition-transform duration-300 transform ${openSection === section.id ? 'rotate-[225deg]' : 'rotate-45'}`}>
                                🏈
                            </span>
                        </button>
                        <div
                            className={`transition-all duration-300 ease-in-out ${openSection === section.id ? 'max-h-[1000px] opacity-100 p-6 border-t border-gray-100 dark:border-gray-700' : 'max-h-0 opacity-0 overflow-hidden'}`}
                        >
                            <div className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                {section.content}
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* Application CTA */}
            <div className="bg-sffl-navy text-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                <div className="space-y-1">
                    <h3 className="font-black text-xl md:text-2xl tracking-tight">Ready to Apply?</h3>
                    <p className="text-gray-300 text-sm md:text-base max-w-md">
                        Ensure all materials are submitted at least 48 hours prior to game time for appropriate screening.
                    </p>
                </div>
                <div className="w-full sm:w-auto">
                    <CopyableEmail email="showtime@sffl.football" label="Inquiries?" className="w-full sm:w-auto inline-block bg-white text-sffl-navy px-8 py-3 font-bold rounded-xl text-center shadow-md hover:bg-gray-100 transition-all cursor-pointer text-base" />
                </div>
            </div>
        </div>
    );
};
