interface TeamMember {
  name: string;
  role: string;
  image?: string;
  bio: string[];
  /** Eyebrow label shown above the name (e.g. "Executive Leadership"). */
  badge?: string;
}

const PRESIDENT: TeamMember = {
  name: "Azeez Amida",
  role: "Founder & President",
  image: "/images/leadership/azeez_amida.webp",
  badge: "Executive Leadership",
  bio: [
    "Azeez Amida is the Founder and President of Showtime Flag Football League, one of the leading figures behind the growth and professionalisation of flag football in Nigeria. Under his leadership, Showtime has grown into one of the world's fastest-growing coed professional flag football leagues, creating structured competitive and development opportunities for hundreds of male and female athletes.",
    "His vision is to build Showtime into a nationally relevant sports and media institution — developing talent, creating sustainable sporting careers, strengthening communities, and presenting Nigerian flag football to a global audience. A business executive and investor with more than two decades of experience, he brings that expertise directly to Showtime's commercial strategy, operating discipline, and long-term ambition.",
  ],
};

const COMMISSIONER: TeamMember = {
  name: "Adebare Adejumo",
  role: "League Commissioner",
  image: "/images/leadership/adebare_adejumo.webp",
  badge: "League Administration",
  bio: [
    "Adebare Adejumo serves as the League Commissioner of Showtime Flag, overseeing the governance, competitive integrity, and overall sporting operations of the league. As chief steward of competition, he works closely with teams, officials, and league stakeholders to uphold the highest standards of fairness, professionalism, and excellence on and off the field.",
    "His leadership shapes league policies, competition structures, and the continued growth of flag football across Nigeria and beyond — driven by a commitment to athlete success and an environment where players, teams, and communities can thrive.",
  ],
};

const KALU_ESTHER: TeamMember = {
  name: "Kalu Esther",
  role: "VP, Operations",
  image: "/images/leadership/kalu_esther.webp",
  badge: "Vice President",
  bio: [
    "Esther Kalu serves as Vice President of Operations at Showtime Flag, overseeing the administrative and operational systems that support the league's day-to-day activities.",
    "She ensures organizational efficiency, manages internal processes, and coordinates logistics across league functions — the structure and stability behind every exceptional experience Showtime delivers for players, partners, and fans.",
  ],
};

const IVIE_OKUNS: TeamMember = {
  name: "Ivie Okuns",
  role: "VP, Commercials",
  badge: "Vice President",
  bio: [
    "Ivie Okuns serves as Vice President of Commercials at Showtime Flag, leading the league's commercial strategy, brand development, marketing, partnerships, and audience growth.",
    "Her work spans sponsorship, content strategy, digital marketing, and event promotion — shaping Showtime's brand identity and positioning it as one of Africa's most innovative, fast-growing sports properties.",
  ],
};

const LEADERSHIP_TEAM: TeamMember[] = [COMMISSIONER, KALU_ESTHER, IVIE_OKUNS];

// Flat navy feature band for the founder, reusing the Incubator section's
// visual language (AboutShowtimeFlag.tsx) so top billing comes from scale
// and color, not a different card style.
const PresidentBand = ({ member }: { member: TeamMember }) => {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <section className="relative overflow-hidden bg-linear-to-r from-gray-900 to-sffl-navy text-white group">
      <div className="flex flex-col md:flex-row items-stretch">
        {/* Photo */}
        <div className="relative w-full md:w-2/5 min-h-80 sm:min-h-96 overflow-hidden bg-black/20">
          {member.image ? (
            <img
              src={member.image}
              alt={member.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 border border-white/10">
              <span className="text-6xl font-black text-white/30">
                {initials}
              </span>
              <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/50">
                Photo Coming Soon
              </span>
            </div>
          )}
          <div
            className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="w-full md:w-3/5 p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center gap-5 min-w-0">
          {member.badge && (
            <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
              <span
                className="h-px w-8 shrink-0 bg-sffl-red"
                aria-hidden="true"
              />
              {member.badge}
            </p>
          )}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase leading-[0.95] tracking-tight text-white wrap-break-word">
              {member.name}
            </h2>
            <p className="mt-2 text-base md:text-lg font-bold uppercase tracking-wide text-sffl-gold">
              {member.role}
            </p>
          </div>
          <span className="h-1 w-12 bg-sffl-red" aria-hidden="true" />
          <div className="space-y-4">
            {member.bio.map((para, index) => (
              <p
                key={index}
                className="text-sm md:text-base text-gray-200 leading-relaxed font-medium"
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Compact vertical card for the league-leadership grid.
const LeadershipCard = ({ member }: { member: TeamMember }) => {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <article className="group flex flex-col border border-gray-200 dark:border-gray-700 border-t-4 border-t-sffl-red bg-white dark:bg-gray-800">
      <div className="relative w-full aspect-4/5 overflow-hidden bg-gray-100 dark:bg-gray-900">
        {member.image ? (
          <img
            src={member.image}
            alt={member.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-sffl-navy to-gray-900 flex flex-col items-center justify-center text-white">
            <span className="text-4xl font-black opacity-40">{initials}</span>
            <span className="mt-3 text-[10px] font-black uppercase tracking-widest opacity-60">
              Photo Coming Soon
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6 min-w-0">
        {member.badge && (
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            <span
              className="h-px w-6 shrink-0 bg-sffl-red"
              aria-hidden="true"
            />
            {member.badge}
          </p>
        )}
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white uppercase tracking-tight wrap-break-word">
            {member.name}
          </h3>
          <p className="mt-1 text-sm font-bold uppercase tracking-wide text-sffl-red">
            {member.role}
          </p>
        </div>
        <span className="h-1 w-10 bg-sffl-red" aria-hidden="true" />
        <div className="space-y-3">
          {member.bio.map((para, index) => (
            <p
              key={index}
              className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium"
            >
              {para}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
};

export const OurTeam = () => {
  return (
    <div className="space-y-8 md:space-y-12">
      <div className="aspect-1920/1082 w-full overflow-hidden border border-sffl-navy bg-gray-100 dark:bg-gray-900">
        <img
          src="/images/team/team-photo-1.webp"
          alt="The Showtime Flag Football team"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>

      <PresidentBand member={PRESIDENT} />

      <div className="space-y-6">
        <h2 className="mb-6 flex items-center gap-3 text-xl md:text-2xl font-black uppercase text-sffl-navy dark:text-white tracking-tight">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          League Leadership
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {LEADERSHIP_TEAM.map((member, i) => (
            <LeadershipCard key={i} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
};
