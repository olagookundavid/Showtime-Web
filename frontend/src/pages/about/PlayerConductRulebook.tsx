import {
  BookOpenIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { buttonClass } from "../../components";

export const PlayerConductRulebook = () => {
  const pdfUrl = "/docs/showtime-player-conduct-rulebook-v2.pdf";

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Desktop & Tablet Layout: Embedded PDF Viewer */}
      <section className="hidden md:block border border-gray-200 dark:border-gray-700 border-t-4 border-t-sffl-red bg-white dark:bg-gray-800 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-700 pb-4 gap-4">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-black text-sffl-navy dark:text-white uppercase">
              <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
              Standard Player Conduct Rulebook
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Browse the official standards of conduct expected of every
              Showtime player below.
            </p>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "md", false, "")}
          >
            <DocumentArrowDownIcon className="w-5 h-5" aria-hidden="true" />
            <span>Download PDF</span>
          </a>
        </div>

        <div className="w-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-2">
          <iframe
            src={`${pdfUrl}#toolbar=1`}
            title="Showtime Standard Player Conduct Rule Book"
            className="w-full h-200 border-0 bg-white"
            loading="lazy"
          />
        </div>
      </section>

      {/* Mobile Layout: Navy Preview Band */}
      <section className="block md:hidden bg-linear-to-r from-gray-900 to-sffl-navy text-white p-6 relative overflow-hidden">
        {/* Decorative Background Icon */}
        <div className="absolute -right-5 -bottom-5 text-white/10 text-9xl font-black pointer-events-none select-none">
          PDF
        </div>

        <div className="relative z-10 space-y-4">
          <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
            <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
            Official Document
          </p>
          <h2 className="text-2xl font-black uppercase tracking-tight">
            Player Conduct Rulebook
          </h2>
          <p className="text-gray-200 text-sm leading-relaxed">
            Access the complete, official Showtime Flag Football League
            standard of player conduct directly on your device.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("primary", "lg", true, "", "dark")}
            >
              <BookOpenIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Open Rulebook</span>
            </a>
            <a
              href={pdfUrl}
              download="Showtime Player Conduct Rulebook.pdf"
              className={buttonClass("outline", "lg", true, "", "dark")}
            >
              <DocumentArrowDownIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Download PDF</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
