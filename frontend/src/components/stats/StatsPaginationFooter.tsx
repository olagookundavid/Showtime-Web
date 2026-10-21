import { IconButton, Button } from "../ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface StatsPaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
}

/** Pager + "Showing X to Y of Z entries" footer shared by the Player/Team Stats tables. */
export const StatsPaginationFooter = ({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
}: StatsPaginationFooterProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm mt-6">
      <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
        Showing{" "}
        <span className="text-sffl-navy dark:text-white font-bold">
          {(page - 1) * limit + 1}
        </span>{" "}
        to{" "}
        <span className="text-sffl-navy dark:text-white font-bold">
          {Math.min(page * limit, totalItems)}
        </span>{" "}
        of{" "}
        <span className="text-sffl-navy dark:text-white font-bold">
          {totalItems}
        </span>{" "}
        entries
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        <IconButton
          variant="secondary"
          icon={ChevronLeftIcon}
          label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        />
        {[...Array(totalPages)].map((_, i) => {
          const p = i + 1;
          // Logic to show limited page numbers if totalPages is large
          if (totalPages > 5) {
            if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
              if (p === 2 && page > 3)
                return (
                  <span key="dots1" aria-hidden="true">
                    …
                  </span>
                );
              if (p === totalPages - 1 && page < totalPages - 2)
                return (
                  <span key="dots2" aria-hidden="true">
                    …
                  </span>
                );
              return null;
            }
          }
          return (
            <Button
              key={p}
              size="sm"
              variant={page === p ? "primary" : "ghost"}
              className="min-w-11"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              {p}
            </Button>
          );
        })}
        <IconButton
          variant="secondary"
          icon={ChevronRightIcon}
          label="Next page"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        />
      </div>
    </div>
  );
};
