import {
  MainHeroCarousel,
  LiveHero,
  ReliveCarousel,
  HeroCarousel,
  TeamOfTheWeekModule,
  Spinner,
  NewsCard,
  ButtonLink,
} from "../components";
import { useLiveStream } from "../hooks";
import { htmlToPlainText } from "../utils";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getNews } from "../services";
import { ArrowPathIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

export const Landing = () => {
  // While the channel is live or a featured video is active, the hero displays
  // the video; the carousel comes back on its own once the setting/stream ends.
  const { isLive, isVideo, videoId, title: heroTitle } = useLiveStream();

  const { data: newsData, isLoading: loadingNews } = useQuery({
    queryKey: ["publicNews", "Commissioner's Note"],
    queryFn: () => getNews(1, 1, undefined, "Commissioner's Note"),
  });

  const { data: teamNewsData, isLoading: loadingTeamNews } = useQuery({
    queryKey: ["publicTeamNews", 6],
    queryFn: () => getNews(1, 6),
  });

  const latestNote = newsData?.data?.[0] || null;
  const teamNews = teamNewsData?.data || [];

  return (
    <div className="space-y-6 md:space-y-12 pt-4">
      {/* Hero — the live stream or featured video when active, the carousel otherwise */}
      <section className="px-1">
        {(isLive || isVideo) && videoId ? (
          <LiveHero videoId={videoId} title={heroTitle} isLive={isLive} />
        ) : (
          <MainHeroCarousel />
        )}
      </section>

      {/* Team of the Week Module */}
      <section className="px-1">
        <TeamOfTheWeekModule showArchiveLink={true} />
      </section>

      {/* RELIVE - YouTube Playlist Video Carousel */}
      <section className="px-1">
        <ReliveCarousel />
      </section>

      {/* Team News — moved immediately after the hero so news is the
                first thing visitors see below the carousel. */}
      <section className="px-1">
        <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 mb-4 md:mb-6">
          <h2 className="text-lg md:text-4xl font-black italic text-sffl-navy dark:text-white transition-colors duration-300">
            <span className="text-sffl-red">NEWS</span>
          </h2>
          <Link
            to="/news"
            className="text-sffl-red text-sm font-semibold hover:underline inline-flex items-center gap-1 min-h-11"
          >
            View All News
            <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {loadingTeamNews ? (
          <Spinner label="Loading news…" />
        ) : teamNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamNews.map((item) => (
              <NewsCard key={item.id} article={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 font-medium italic">
              No recent news available.
            </p>
          </div>
        )}
      </section>

      {/* Commissioner's Note */}
      <section className="px-1 md:px-0">
        <div className="max-w-2xl mx-auto">
          {/* Commissioner's Note */}
          <div className="bg-sffl-navy dark:bg-gray-800 text-white p-5 md:p-8 shadow-xl border border-transparent dark:border-gray-700 flex flex-col h-full relative overflow-hidden group min-h-80">
            {/* Commissioner background image */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src="https://cdn.showtimeflag.football/files/adebare-adejumo.webp"
                alt="Adebare Adejumo - League Commissioner"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-top filter brightness-90 group-hover:scale-105 transition-transform duration-700 opacity-40 dark:opacity-30"
              />
              <div className="absolute inset-0 bg-linear-to-t from-sffl-navy via-sffl-navy/85 to-sffl-navy/70 dark:from-gray-900 dark:via-gray-900/90 dark:to-gray-900/75"></div>
            </div>

            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-32 h-32 bg-sffl-red/10 rounded-full blur-2xl group-hover:bg-sffl-red/20 transition-all duration-700 z-10"></div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-6 relative z-10">
              <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
                Commissioner's <span className="text-sffl-red">Note</span>
              </h3>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/10 dark:bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm text-gray-200">
                Adebare Adejumo
              </span>
            </div>

            {loadingNews ? (
              <div className="flex-1 flex justify-center items-center py-8 relative z-10 text-white">
                <ArrowPathIcon
                  className="w-8 h-8 animate-spin"
                  aria-label="Loading"
                />
              </div>
            ) : latestNote ? (
              <div className="relative z-10 flex flex-col h-full">
                <p className="text-gray-200 dark:text-gray-200 mb-8 italic flex-1 relative z-10 leading-relaxed text-sm md:text-base before:content-['\201C'] before:absolute before:-top-6 before:-left-4 before:text-7xl before:text-sffl-red/30 before:-z-10 after:content-['\201D'] after:relative after:-bottom-4 after:text-5xl after:text-sffl-red/30 after:leading-none">
                  {latestNote.excerpt ||
                    htmlToPlainText(latestNote.content).substring(0, 200) + "…"}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                  <ButtonLink
                    to={`/news/${latestNote.slug}`}
                    variant="primary"
                    size="lg"
                    shape="square"
                    icon={ArrowRightIcon}
                    iconPosition="right"
                  >
                    Read Full Note
                  </ButtonLink>
                  <span className="text-xs text-gray-300 font-medium italic hidden sm:inline">
                    — Adebare Adejumo
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 relative z-10 backdrop-blur-xs">
                <p className="text-gray-300 dark:text-gray-400 italic font-medium">
                  No commissioner's note at this time.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Promotional Carousel */}
      <HeroCarousel />
    </div>
  );
};
