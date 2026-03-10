import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
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
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="flex justify-center items-center space-x-2 mt-8">
            {/* Previous Button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 min-h-[44px] rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${currentPage === 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'bg-white text-sffl-navy hover:bg-sffl-red hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-sffl-red border border-gray-300 dark:border-gray-600'
                    }`}
            >
                Previous
            </button>

            {/* Page Numbers */}
            {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                    {page === '...' ? (
                        <span className="px-2 text-gray-500">...</span>
                    ) : (
                        <button
                            onClick={() => onPageChange(page as number)}
                            className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${currentPage === page
                                ? 'bg-sffl-red text-white'
                                : 'bg-white text-sffl-navy hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
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
                className={`px-4 py-2 min-h-[44px] rounded-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${currentPage === totalPages
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'bg-white text-sffl-navy hover:bg-sffl-red hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-sffl-red border border-gray-300 dark:border-gray-600'
                    }`}
            >
                Next
            </button>
        </div>
    );
};
