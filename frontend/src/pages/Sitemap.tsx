import { Link } from "react-router-dom";

interface SitemapGroup {
  title: string;
  links: { name: string; path: string }[];
}

// The top-level public pages, for people. Keep in step with public/sitemap.xml
// (the XML one for search engines). No detail pages (single match, player, ...).
const GROUPS: SitemapGroup[] = [
  {
    title: "League",
    links: [
      { name: "Home", path: "/" },
      { name: "Matches", path: "/matches" },
      { name: "Standings", path: "/standings" },
      { name: "Player Stats", path: "/stats" },
      { name: "Team Stats", path: "/stats/teams" },
      { name: "Team of the Week", path: "/totw" },
      { name: "Player of the Week", path: "/potw" },
    ],
  },
  {
    title: "Teams & Players",
    links: [
      { name: "Teams", path: "/teams" },
      { name: "Players", path: "/players" },
      { name: "Compare Players", path: "/players/compare" },
    ],
  },
  {
    title: "News",
    links: [{ name: "News", path: "/news" }],
  },
  {
    title: "Tickets, Store & Fantasy",
    links: [
      { name: "Tickets", path: "/tickets" },
      { name: "Store", path: "/store" },
      { name: "Fantasy", path: "/fantasy" },
      { name: "Fantasy Player Stats", path: "/fantasy/players" },
    ],
  },
  {
    title: "About",
    links: [
      { name: "About Showtime Flag", path: "/about/showtime-flag" },
      { name: "Our Team", path: "/about/our-team" },
      { name: "Showtime Arena", path: "/about/arena" },
      // { name: "Education", path: "/about/education" }, // page taken out for now
      { name: "Sponsorships", path: "/about/sponsorships" },
    ],
  },
  {
    title: "Rules & Policy",
    links: [
      { name: "Gameplay Rules", path: "/about/rules" },
      { name: "Player Conduct", path: "/about/player-conduct" },
      { name: "Byelaws", path: "/about/byelaws" },
      { name: "Media Guidelines", path: "/about/media-guidelines" },
      { name: "FAQ", path: "/about/faq" },
      { name: "Whistleblower", path: "/about/whistleblower" },
      { name: "Privacy Policy", path: "/about/privacy" },
    ],
  },
];

export const Sitemap = () => {
  return (
    <div className="space-y-4 md:space-y-8">
      <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
          SITEMAP
        </h1>
        <p className="text-gray-300 mt-2">Every page on Showtime Flag in one place</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {GROUPS.map((group) => (
          <section
            key={group.title}
            className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md min-w-0"
          >
            <h2 className="text-lg font-bold text-sffl-red mb-2">{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-700 dark:text-gray-100 hover:text-sffl-red min-h-11 flex items-center wrap-break-word"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
