interface TeamMember {
  name: string;
  role: string;
  image?: string;
}

const PRESIDENT: TeamMember = {
  name: "Azeez Amida",
  role: "President",
  image: "https://cdn.showtimeflag.football/files/azeez-amida.png",
};

const ADEBARE_ADEJUMO: TeamMember = {
  name: "Adebare Adejumo",
  role: "League Commissioner",
  image: "https://cdn.showtimeflag.football/files/adebare-adejumo.webp",
};

const KALU_ESTHER: TeamMember = {
  name: "Kalu Esther",
  role: "General Manager/SVP, Showtime Arena",
  image: "https://cdn.showtimeflag.football/files/esther-kalu.webp",
};

const NSIDIBE_ABASI_ASUQUO: TeamMember = {
  name: "Nsidibe-Abasi Asuquo",
  role: "VP, Production",
  image: "https://cdn.showtimeflag.football/files/nsidibe-abasi-asuquo.jpg",
};

const NNENNA_ORJI: TeamMember = {
  name: "Nnenna Orji",
  role: "Head, Social Media",
  image: "https://cdn.showtimeflag.football/files/nnenna-orji.jpg",
};

const EWOMA_AKWENUKE: TeamMember = {
  name: "Ewoma Akwenuke",
  role: "VP, Sponsorship, Business Development and Sales",
  image: "https://cdn.showtimeflag.football/files/ewoma-akwenuke.jpg",
};

const DAVID_OLAGOOKUN: TeamMember = {
  name: "David Olagookun",
  role: "VP, Information Technology",
  image: "",
};

const EDEMHANRIA_DEBORAH: TeamMember = {
  name: "Edemhanria Deborah",
  role: "VP, Sponsorship, Business Development and Sales",
  image: "",
};

const CHIMEZURU_ANO_ANYANWU: TeamMember = {
  name: "Chimezuru Ano-Anyanwu",
  role: "Head, Creatives",
  image: "",
};

const BLESSING_OMONIGHO: TeamMember = {
  name: "Blessing Omonigho",
  role: "Café Manager",
  image: "",
};

const TERSUR_KANGE: TeamMember = {
  name: "Tersur Kange",
  role: "VP, People and Culture",
  image: "",
};

const LEADERSHIP_TEAM: TeamMember[] = [
  PRESIDENT,
  KALU_ESTHER,
  ADEBARE_ADEJUMO,
  EWOMA_AKWENUKE,
  EDEMHANRIA_DEBORAH,
  NSIDIBE_ABASI_ASUQUO,
  NNENNA_ORJI,
  TERSUR_KANGE,
  DAVID_OLAGOOKUN,
  CHIMEZURU_ANO_ANYANWU,
  BLESSING_OMONIGHO,
];

// Compact vertical card for the league-leadership grid. The president uses
// the same card shape but in navy so top billing comes from color, not a
// different layout.
const LeadershipCard = ({
  member,
  navy = false,
}: {
  member: TeamMember;
  navy?: boolean;
}) => {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <article
      className={`group flex flex-col border-t-4 ${
        navy
          ? "border border-sffl-navy border-t-sffl-gold bg-sffl-navy"
          : "border border-gray-200 dark:border-gray-700 border-t-sffl-red bg-white dark:bg-gray-800"
      }`}
    >
      <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-gray-900">
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
        <div>
          <h3
            className={`text-xl sm:text-2xl font-black uppercase tracking-tight wrap-break-word ${
              navy ? "text-white" : "text-sffl-navy dark:text-white"
            }`}
          >
            {member.name}
          </h3>
          <p
            className={`mt-1 text-sm font-bold uppercase tracking-wide ${
              navy ? "text-sffl-gold" : "text-sffl-red"
            }`}
          >
            {member.role}
          </p>
        </div>
        <span
          className={`h-1 w-10 ${navy ? "bg-sffl-gold" : "bg-sffl-red"}`}
          aria-hidden="true"
        />
      </div>
    </article>
  );
};

export const OurTeam = () => {
  return (
    <div className="space-y-8 md:space-y-12">
      <div className="space-y-6">
        <h2 className="mb-6 flex items-center gap-3 text-xl md:text-2xl font-black uppercase text-sffl-navy dark:text-white tracking-tight">
          <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
          League Leadership
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {LEADERSHIP_TEAM.map((member, i) => (
            <LeadershipCard
              key={i}
              member={member}
              navy={member === PRESIDENT}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
