
interface TeamMember {
    name: string;
    role: string;
    image?: string;
    bio: string[];
}

const COMMISSIONER: TeamMember = {
    name: 'Adebare Adejumo',
    role: 'League Commissioner',
    image: '/images/leadership/adebare_adejumo.jpg',
    bio: [
        'Adebare Adejumo serves as the League Commissioner of Showtime Flag, where he oversees the governance, competitive integrity, and overall sporting operations of the league.',
        'As the chief steward of competition, he works closely with teams, officials, and league stakeholders to ensure that Showtime Flag maintains the highest standards of fairness, professionalism, and excellence on and off the field. His leadership is instrumental in shaping league policies, managing competition structures, and supporting the continued growth of flag football across Nigeria and beyond.',
        'Driven by a passion for sport development and athlete success, he remains committed to creating an environment where players, teams, and communities can thrive while advancing Showtime Flag\'s vision of becoming a leading force in global flag football.'
    ],
};

const LEADERS: TeamMember[] = [
    {
        name: 'Kalu Esther',
        role: 'VP, Operations',
        image: '/images/leadership/kalu_esther.jpg',
        bio: [
            'Esther Kalu serves as the Vice President of Operations at Showtime Flag, overseeing the administrative and operational systems that support the league\'s day-to-day activities.',
            'She plays a critical role in ensuring organizational efficiency, managing internal processes, coordinating logistics, and providing operational support across league functions. Her attention to detail and commitment to excellence help create the structure and stability necessary for Showtime Flag to deliver exceptional experiences for players, partners, and fans.',
            'With a strong focus on organization and execution, she helps ensure that the league continues to operate smoothly while supporting its long-term growth and development.'
        ],
    },
    {
        name: 'Ivie Okuns',
        role: 'VP, Commercials',
        bio: [
            'Ivie Okuns serves as the Vice President of Commercials at Showtime Flag, where she leads the league\'s commercial strategy, brand development, marketing, partnerships, and audience growth initiatives.',
            'With a passion for building communities through sport and storytelling, Ivie has played a key role in shaping Showtime Flag\'s brand identity and expanding its reach among fans, partners, and stakeholders. Her work spans sponsorship acquisition, content strategy, digital marketing, event promotion, and business development, helping to position Showtime Flag as one of Africa\'s most innovative and fast-growing sports properties.',
            'She remains committed to advancing Showtime Flag\'s mission of growing flag football, fostering community, and creating pathways for participation and excellence across the sport.'
        ],
    },
];

export const OurTeam = () => {
    return (
        <div className="space-y-8 md:space-y-12 pb-16">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-sffl-red/20 to-blue-900/30" />
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">OUR TEAM</h1>
                    <p className="text-sm md:text-xl text-gray-300 mt-2 font-semibold uppercase tracking-widest">Showtime Leadership & Sporting Operations</p>
                </div>
            </div>

            {/* Commissioner Highlight */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden group">
                <div className="flex flex-col md:flex-row items-stretch">
                    {/* Image Container */}
                    <div className="w-full md:w-2/5 min-h-[360px] md:min-h-[460px] relative overflow-hidden bg-gray-100 dark:bg-gray-900">
                        {COMMISSIONER.image ? (
                            <img 
                                src={COMMISSIONER.image} 
                                alt={COMMISSIONER.name} 
                                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-sffl-navy to-gray-900 flex items-center justify-center text-white text-3xl font-bold">
                                {COMMISSIONER.name.split(' ').map(n => n[0]).join('')}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 via-transparent to-transparent" />
                    </div>
                    {/* Content */}
                    <div className="w-full md:w-3/5 p-6 md:p-10 flex flex-col justify-center space-y-4">
                        <div>
                            <span className="px-3 py-1 bg-sffl-red text-white text-[10px] md:text-xs font-black uppercase rounded-full tracking-wider">
                                League Administration
                            </span>
                            <h2 className="text-2xl md:text-4xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mt-3">
                                {COMMISSIONER.name}
                            </h2>
                            <p className="text-base md:text-lg text-sffl-red font-bold uppercase tracking-wide mt-1">
                                {COMMISSIONER.role}
                            </p>
                        </div>
                        <div className="w-12 h-1 bg-sffl-red rounded" />
                        <div className="space-y-3">
                            {COMMISSIONER.bio.map((para, index) => (
                                <p key={index} className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Board Members Grid */}
            <div className="space-y-6">
                <div className="text-center md:text-left border-b border-gray-100 dark:border-gray-700 pb-3">
                    <h3 className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                        Vice Presidents
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8">
                    {LEADERS.map((leader, i) => (
                        <div 
                            key={i} 
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                        >
                            {/* Image Frame */}
                            <div className="h-64 md:h-80 w-full relative overflow-hidden bg-gray-50 dark:bg-gray-900/30">
                                {leader.image ? (
                                    <img 
                                        src={leader.image} 
                                        alt={leader.name} 
                                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center text-white">
                                        <span className="text-5xl font-black opacity-30">
                                            {leader.name.split(' ').map(n => n[0]).join('')}
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-55">
                                            Photo Coming Soon
                                        </span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent" />
                            </div>
                            {/* Details */}
                            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                                <div className="space-y-3">
                                    <h4 className="text-lg font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                                        {leader.name}
                                    </h4>
                                    <p className="text-xs text-sffl-red font-bold uppercase tracking-wider">
                                        {leader.role}
                                    </p>
                                    <div className="space-y-2">
                                        {leader.bio.map((para, index) => (
                                            <p key={index} className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                                {para}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
