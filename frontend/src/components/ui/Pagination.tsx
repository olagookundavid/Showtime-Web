import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  // if (totalPages <= 1) return null; // Always show for now per user request

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first, last, and current +/- 1
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap justify-center items-center gap-2 mt-8"
    >
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-11 min-w-11 rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
          currentPage === 1
            ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            : "bg-white text-sffl-navy hover:bg-sffl-red hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-sffl-red border border-gray-300 dark:border-gray-600"
        }`}
      >
        <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        <React.Fragment key={index}>
          {page === "..." ? (
            <span className="px-1 text-gray-500" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              onClick={() => onPageChange(page as number)}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
              className={`w-11 h-11 min-h-11 min-w-11 rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
                currentPage === page
                  ? "bg-sffl-red text-white"
                  : "bg-white text-sffl-navy hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
              }`}
            >
              {page}
            </button>
          )}
        </React.Fragment>
      ))}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-11 min-w-11 rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
          currentPage === totalPages
            ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
            : "bg-white text-sffl-navy hover:bg-sffl-red hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-sffl-red border border-gray-300 dark:border-gray-600"
        }`}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
};
