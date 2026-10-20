import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "./Spinner";
import { Button } from "./Button";
import { Input } from "./Input";

export interface Column<T> {
  /** Header text, or a node for a two-line label. */
  header: ReactNode;
  accessor?: keyof T | string;
  cell?: (item: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | null | undefined; // For sorting if accessor isn't enough
  className?: string; // td className
  /** Aligns the header and the cells. */
  align?: "left" | "center" | "right";
  /** Sort controlled by the page (e.g. leaders first, then back to default). Makes the header a button that calls this. Don't combine with `sortable`. */
  onSort?: () => void;
  /** With `onSort`: marks this column as the active sort. */
  sortActive?: boolean;
  /** Padding for the header label, when the default px-4 is too wide for a narrow column. */
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  emptyMessage?: string;
  headerActions?: ReactNode; // Extra filters or buttons
  onSearchSubmit?: (searchTerm: string) => void; // For trigger server-side search
  serverPage?: number;
  totalServerPages?: number;
  onPageChange?: (page: number) => void;
  /** Shows a spinner in place of the rows. The toolbar and header stay on screen. */
  loading?: boolean;
  /** false shows every row and hides the pager. */
  paginated?: boolean;
  /** Stable row keys. Defaults to the row's position. */
  getRowId?: (row: T) => string;
  /** For a few short columns, e.g. inside a dialog: drops the 800px minimum width so the table fits its container. */
  compact?: boolean;
  /** Row background and state classes, e.g. a highlighted or champion row. Include a background: the frozen first cell takes it. */
  rowClassName?: (row: T) => string;
  /** Makes each row clickable, e.g. to open the record. Keep a button in the row for keyboard users. */
  onRowClick?: (row: T) => void;
  /** Keeps the header row on screen while the rows scroll inside `maxHeight`. Needs `maxHeight`. */
  stickyHeader?: boolean;
  /** Tailwind max-height class for the scrolling area, e.g. "max-h-[70dvh]". */
  maxHeight?: string;
  /** Draws our own scrollbars (a bar above the header, one below the table, and one on the right when `maxHeight` is set) instead of each browser's native ones, so all three are pixel-identical. On by default; pass false to fall back to native scrollbars for this table. */
  customScrollbars?: boolean;
}

// TanStack Table (v9) does the sorting, searching and paging; this file owns the markup and styling.
// Features are declared once, outside the component, so they stay stable between renders.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature, // required by global filtering
  globalFilteringFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
  filterFns,
});
type Features = typeof features;

// Sorting has always compared the raw values with < and >, treating null/undefined as ''.
const compareValues = <T extends RowData>(
  rowA: Row<Features, T>,
  rowB: Row<Features, T>,
  columnId: string,
) => {
  let a = rowA.getValue<unknown>(columnId);
  let b = rowB.getValue<unknown>(columnId);
  if (a == null) a = "";
  if (b == null) b = "";
  if ((a as string | number) < (b as string | number)) return -1;
  if ((a as string | number) > (b as string | number)) return 1;
  return 0;
};

// Search has always matched against every field of the row, not only the visible columns.
const matchesAnyField = <T extends RowData>(
  row: Row<Features, T>,
  _columnId: string,
  term: unknown,
) => {
  const needle = String(term).toLowerCase();
  return Object.values(row.original as Record<string, unknown>).some((v) =>
    String(v).toLowerCase().includes(needle),
  );
};

const ALIGN_TEXT = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;
const ALIGN_FLEX = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

const DEFAULT_CELL_CLASS = "px-4 py-3 text-sm text-gray-900 dark:text-gray-300";

// The first column stays put while the rest of the table scrolls sideways under it, so its
// cells need an opaque background. The row hover is opaque for the same reason; in dark mode
// it is the old gray-700/50 over the gray-800 card, mixed into one solid colour.
const STICKY_CELL =
  "sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700";
const ROW_HOVER =
  "transition-colors group-hover:bg-gray-50 dark:group-hover:bg-[color-mix(in_oklab,var(--color-gray-700)_50%,var(--color-gray-800))]";
const ROW_DIVIDER =
  "border-b border-gray-200 dark:border-gray-700 group-last:border-b-0";

// Our own scrollbars, so the top strip, the bottom bar and the right-hand bar are byte-for-byte
// the same component in three places, instead of three different native renderers (Chrome, Edge
// and Firefox each draw a native/`scrollbar-width:thin` scrollbar slightly differently). Their
// thickness (6px) lives in the h-1.5 / w-1.5 classes below, on the track divs and MIN_THUMB_PX.
const MIN_THUMB_PX = 24;
// No `position` utility here - the horizontal bars need `relative` (plain block, positions
// their own thumb), the vertical bar needs `absolute` (anchors to the scroll area's wrapper);
// baking either one in would conflict with the other at the call site.
const TRACK_CLASS = "shrink-0 bg-gray-100 dark:bg-gray-900/50";
const THUMB_CLASS =
  "absolute rounded-full bg-sffl-red hover:bg-red-700 active:bg-red-800 transition-colors cursor-pointer touch-none";

type ScrollAxis = "x" | "y";

interface ThumbGeometry {
  thumbPx: number;
  offsetPx: number;
  valueNow: number;
}

// null means "no overflow on this axis" - the caller hides the bar entirely, matching how a
// native scrollbar disappears when its content already fits.
function computeThumbGeometry(
  scrollPos: number,
  contentSize: number,
  viewportSize: number,
  trackSize: number,
): ThumbGeometry | null {
  if (contentSize <= viewportSize + 1 || trackSize <= 0) return null;
  const rawThumb = (viewportSize / contentSize) * trackSize;
  const thumbPx = Math.max(MIN_THUMB_PX, Math.min(trackSize, rawThumb));
  const scrollRange = contentSize - viewportSize;
  const trackRange = trackSize - thumbPx;
  const ratio = scrollRange > 0 ? scrollPos / scrollRange : 0;
  return {
    thumbPx,
    offsetPx: Math.max(0, Math.min(trackRange, ratio * trackRange)),
    valueNow: Math.round(ratio * 100),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  itemsPerPage = 10,
  emptyMessage = "No records found.",
  headerActions,
  onSearchSubmit,
  serverPage,
  totalServerPages,
  onPageChange,
  loading = false,
  paginated = true,
  getRowId,
  compact = false,
  rowClassName,
  onRowClick,
  stickyHeader = false,
  maxHeight,
  customScrollbars = true,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [internalPage, setInternalPage] = useState(1);

  const scrollRegionId = useId();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const topTrackRef = useRef<HTMLDivElement>(null);
  const topThumbRef = useRef<HTMLDivElement>(null);
  const bottomTrackRef = useRef<HTMLDivElement>(null);
  const bottomThumbRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLDivElement>(null);
  const vThumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    axis: ScrollAxis;
    startClient: number;
    startScroll: number;
    scrollRange: number;
    trackRange: number;
  } | null>(null);

  const setHorizontalBar = (
    trackRef: RefObject<HTMLDivElement | null>,
    thumbRef: RefObject<HTMLDivElement | null>,
    geo: ThumbGeometry | null,
  ) => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;
    track.style.display = geo ? "" : "none";
    if (!geo) return;
    thumb.style.width = `${geo.thumbPx}px`;
    thumb.style.left = `${geo.offsetPx}px`;
    thumb.setAttribute("aria-valuenow", String(geo.valueNow));
  };

  const updateThumbs = () => {
    const container = scrollContainerRef.current;
    if (!container || !customScrollbars) return;
    const { scrollLeft, scrollWidth, clientWidth, scrollTop, scrollHeight, clientHeight } =
      container;

    const hTrackSize = topTrackRef.current?.clientWidth ?? clientWidth;
    const hGeo = computeThumbGeometry(scrollLeft, scrollWidth, clientWidth, hTrackSize);
    setHorizontalBar(topTrackRef, topThumbRef, hGeo);
    setHorizontalBar(bottomTrackRef, bottomThumbRef, hGeo);

    if (maxHeight) {
      const vTrackSize = vTrackRef.current?.clientHeight ?? clientHeight;
      const vGeo = computeThumbGeometry(scrollTop, scrollHeight, clientHeight, vTrackSize);
      const track = vTrackRef.current;
      const thumb = vThumbRef.current;
      if (track && thumb) {
        track.style.display = vGeo ? "" : "none";
        if (vGeo) {
          thumb.style.height = `${vGeo.thumbPx}px`;
          thumb.style.top = `${vGeo.offsetPx}px`;
          thumb.setAttribute("aria-valuenow", String(vGeo.valueNow));
        }
      }
    }
  };

  // Measured and applied imperatively (never setState), so neither a data change that alters
  // column widths nor a window resize can trigger a render loop through this effect.
  useLayoutEffect(() => {
    if (!customScrollbars) return;
    const container = scrollContainerRef.current;
    const tableEl = tableRef.current;
    if (!container || !tableEl) return;

    updateThumbs();
    const observer = new ResizeObserver(updateThumbs);
    observer.observe(container);
    observer.observe(tableEl);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customScrollbars, maxHeight]);

  const handleScroll = () => {
    if (customScrollbars) updateThumbs();
  };

  const onDragMove = (e: PointerEvent) => {
    const state = dragRef.current;
    const container = scrollContainerRef.current;
    if (!state || !container) return;
    const clientPos = state.axis === "x" ? e.clientX : e.clientY;
    const delta = clientPos - state.startClient;
    const scrollDelta =
      state.trackRange > 0 ? (delta / state.trackRange) * state.scrollRange : 0;
    if (state.axis === "x") {
      container.scrollLeft = state.startScroll + scrollDelta;
    } else {
      container.scrollTop = state.startScroll + scrollDelta;
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", endDrag);
  };

  const onThumbPointerDown =
    (axis: ScrollAxis) => (e: ReactPointerEvent<HTMLDivElement>) => {
      const container = scrollContainerRef.current;
      const track = axis === "x" ? topTrackRef.current : vTrackRef.current;
      if (!container || !track) return;
      e.preventDefault();
      e.stopPropagation();
      const trackSize = axis === "x" ? track.clientWidth : track.clientHeight;
      const thumbSize =
        axis === "x" ? e.currentTarget.offsetWidth : e.currentTarget.offsetHeight;
      const contentSize = axis === "x" ? container.scrollWidth : container.scrollHeight;
      const viewportSize = axis === "x" ? container.clientWidth : container.clientHeight;
      dragRef.current = {
        axis,
        startClient: axis === "x" ? e.clientX : e.clientY,
        startScroll: axis === "x" ? container.scrollLeft : container.scrollTop,
        scrollRange: contentSize - viewportSize,
        trackRange: trackSize - thumbSize,
      };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", endDrag);
    };

  // Clicking the bare track (not the thumb, which stops propagation before this fires) jumps
  // toward that point, centering the thumb under the pointer - the common scrollbar convention.
  const onTrackPointerDown =
    (axis: ScrollAxis) => (e: ReactPointerEvent<HTMLDivElement>) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPos = axis === "x" ? e.clientX - rect.left : e.clientY - rect.top;
      const trackSize = axis === "x" ? rect.width : rect.height;
      const contentSize = axis === "x" ? container.scrollWidth : container.scrollHeight;
      const viewportSize = axis === "x" ? container.clientWidth : container.clientHeight;
      const target = (clickPos / trackSize) * contentSize - viewportSize / 2;
      if (axis === "x") container.scrollLeft = target;
      else container.scrollTop = target;
    };

  const onThumbKeyDown = (axis: ScrollAxis) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const step = axis === "x" ? container.clientWidth : container.clientHeight;
    const key = e.key;
    const forwardKey = axis === "x" ? "ArrowRight" : "ArrowDown";
    const backKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
    if (key === forwardKey || key === backKey) {
      const delta = (key === forwardKey ? 1 : -1) * step * 0.1;
      if (axis === "x") container.scrollLeft += delta;
      else container.scrollTop += delta;
      e.preventDefault();
    } else if (key === "Home") {
      if (axis === "x") container.scrollLeft = 0;
      else container.scrollTop = 0;
      e.preventDefault();
    } else if (key === "End") {
      if (axis === "x") container.scrollLeft = container.scrollWidth;
      else container.scrollTop = container.scrollHeight;
      e.preventDefault();
    }
  };

  const renderHorizontalBar = (
    trackRef: RefObject<HTMLDivElement | null>,
    thumbRef: RefObject<HTMLDivElement | null>,
    rounding: string,
  ) => (
    <div
      ref={trackRef}
      onPointerDown={onTrackPointerDown("x")}
      className={`${TRACK_CLASS} relative h-1.5 ${rounding}`}
    >
      <div
        ref={thumbRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls={scrollRegionId}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={onThumbPointerDown("x")}
        onKeyDown={onThumbKeyDown("x")}
        className={`${THUMB_CLASS} inset-y-0`}
        style={{ width: 0, left: 0 }}
      />
    </div>
  );

  const isServerPaginated =
    serverPage !== undefined &&
    totalServerPages !== undefined &&
    onPageChange !== undefined;
  const currentPage = isServerPaginated ? serverPage! : internalPage;

  // Back to page 1 whenever the search or the number of rows changes (only matters for local paging).
  const resetKey = `${searchTerm}|${data.length}`;
  const [pageResetKey, setPageResetKey] = useState(resetKey);
  if (pageResetKey !== resetKey) {
    setPageResetKey(resetKey);
    setInternalPage(1);
  }

  const handlePageChange = (p: number) => {
    if (isServerPaginated) {
      onPageChange!(p);
    } else {
      setInternalPage(p);
    }
  };

  // Callers pass a fresh `columns` array every render, so this recomputes each time. That is cheap
  // at these table sizes. Callers that memoize their columns skip the work.
  const tableColumns = useMemo<ColumnDef<Features, T>[]>(
    () =>
      columns.map((col, i) => ({
        id: String(i),
        header: () => col.header,
        accessorFn: (row: T) => {
          const value = col.sortValue
            ? col.sortValue(row)
            : col.accessor
              ? row[col.accessor as keyof T]
              : "";
          return value ?? "";
        },
        cell: ({ row }) =>
          col.cell
            ? col.cell(row.original)
            : col.accessor
              ? (row.original[col.accessor as keyof T] as ReactNode)
              : null,
        enableSorting: !!col.sortable,
        sortFn: compareValues,
        sortUndefined: false,
      })),
    [columns],
  );

  // Owned here, not by the table, so the page can come from the server.
  const pagination = useMemo(
    () => ({
      pageIndex: currentPage - 1,
      pageSize: paginated ? itemsPerPage : Infinity,
    }),
    [currentPage, paginated, itemsPerPage],
  );

  const table = useTable({
    features,
    columns: tableColumns,
    data,
    getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
    state: {
      pagination,
      // Server-side search leaves the rows alone; the parent refetches instead.
      globalFilter: onSearchSubmit || !searchTerm ? undefined : searchTerm,
    },
    globalFilterFn: matchesAnyField,
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated ? totalServerPages : undefined,
    autoResetPageIndex: false, // we reset the page ourselves, above
    enableSortingRemoval: false, // clicking a header only flips between ascending and descending
    sortDescFirst: false,
    enableMultiSort: false,
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getRowCount();
  const totalPages = paginated ? table.getPageCount() : 1;
  const showToolbar = searchable || !!headerActions;

  // The frozen cell takes its row's background (bg-inherit), so a highlighted row stays one colour.
  const cellClass = (col: Column<T>, first: boolean) =>
    `${col.className || DEFAULT_CELL_CLASS}${col.align ? ` ${ALIGN_TEXT[col.align]}` : ""} ${ROW_DIVIDER} ${ROW_HOVER}${first ? ` ${STICKY_CELL} bg-inherit` : ""}`;

  return (
    <div className="space-y-4">
      {/* Header Actions & Search - Condensed */}
      {showToolbar && (
        <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white dark:bg-gray-800 p-2 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {searchable && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    onSearchSubmit &&
                    onSearchSubmit(searchTerm)
                  }
                  className="w-full sm:w-64"
                />
                {onSearchSubmit && (
                  <Button onClick={() => onSearchSubmit(searchTerm)}>Search</Button>
                )}
              </div>
            )}
          </div>
          {headerActions && (
            <div className="flex flex-wrap items-center gap-3">
              {headerActions}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Our own top/bottom/right scrollbars (identical thickness and colour) replace the
            native ones (hidden via `no-scrollbar`) so they render the same in every browser. */}
        {customScrollbars && renderHorizontalBar(topTrackRef, topThumbRef, "rounded-t-xl")}

        <div className="relative">
          {/* The same table on every screen: on a phone it scrolls sideways and the first column
                      stays frozen. `isolate` keeps the frozen cells' z-index inside the table.
                      Borders sit on the cells (border-separate), because with border-collapse a sticky
                      cell's borders scroll away and the row lines vanish under the frozen column. */}
          <div
            ref={scrollContainerRef}
            id={scrollRegionId}
            onScroll={handleScroll}
            className={`relative isolate overflow-x-auto${customScrollbars ? " no-scrollbar" : ""}${maxHeight ? ` overflow-y-auto ${maxHeight}` : ""}`}
          >
            <table
              ref={tableRef}
              className={`w-full text-left border-separate border-spacing-0 ${compact ? "" : "min-w-200"}`}
            >
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="bg-gray-50 dark:bg-gray-800/50">
                    {group.headers.map((header, i) => {
                      const col = columns[Number(header.column.id)];
                      const align = col?.align ?? "left";
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const labelClass = `flex items-center gap-1.5 w-full min-h-11 ${col?.headerClassName ?? "px-4 py-2"} ${ALIGN_FLEX[align]}`;
                      // A sticky header needs an opaque background; the frozen first header is also above the frozen cells.
                      const headerSticky = stickyHeader ? " sticky top-0 z-20 bg-gray-50 dark:bg-gray-800" : "";
                      const frozenHeader = i === 0 ? ` ${STICKY_CELL} bg-gray-50 dark:bg-gray-800${stickyHeader ? " z-30" : ""}` : "";
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : canSort
                                  ? "none"
                                  : undefined
                          }
                          className={`p-0 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 ${ALIGN_TEXT[align]}${frozenHeader}${headerSticky}`}
                        >
                          {col?.onSort ? (
                            <button
                              type="button"
                              onClick={col.onSort}
                              className={`${labelClass} uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition ${col.sortActive ? "text-sffl-red" : ""}`}
                            >
                              <table.FlexRender header={header} />
                              {col.sortActive ? (
                                <ChevronDownIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                              ) : (
                                <ChevronUpDownIcon className="w-4 h-4 opacity-40 shrink-0" aria-hidden="true" />
                              )}
                            </button>
                          ) : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={`${labelClass} uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
                            >
                              <table.FlexRender header={header} />
                              {sorted === "asc" ? (
                                <ChevronUpIcon
                                  className="w-4 h-4 text-sffl-red"
                                  aria-hidden="true"
                                />
                              ) : sorted === "desc" ? (
                                <ChevronDownIcon
                                  className="w-4 h-4 text-sffl-red"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronUpDownIcon
                                  className="w-4 h-4 opacity-40"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ) : (
                            <div className={labelClass}>
                              <table.FlexRender header={header} />
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <Spinner />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={`group ${rowClassName ? rowClassName(row.original) : "bg-white dark:bg-gray-800"}${onRowClick ? " cursor-pointer" : ""}`}
                    >
                      {row.getAllCells().map((cell, i) => (
                        <td
                          key={cell.id}
                          className={cellClass(
                            columns[Number(cell.column.id)],
                            i === 0,
                          )}
                        >
                          {i === 0 ? (
                            // Table cells ignore max-width, so the cap goes on a wrapper. It stops a
                            // long name from covering most of a phone screen.
                            <div className="max-w-[45vw] md:max-w-none">
                              <table.FlexRender cell={cell} />
                            </div>
                          ) : (
                            <table.FlexRender cell={cell} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {customScrollbars && maxHeight && (
            <div
              ref={vTrackRef}
              onPointerDown={onTrackPointerDown("y")}
              className={`${TRACK_CLASS} absolute top-0 right-0 bottom-0 w-1.5 z-40`}
            >
              <div
                ref={vThumbRef}
                role="scrollbar"
                aria-orientation="vertical"
                aria-controls={scrollRegionId}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onPointerDown={onThumbPointerDown("y")}
                onKeyDown={onThumbKeyDown("y")}
                className={`${THUMB_CLASS} inset-x-0`}
                style={{ height: 0, top: 0 }}
              />
            </div>
          )}
        </div>

        {customScrollbars && renderHorizontalBar(bottomTrackRef, bottomThumbRef, "rounded-b-xl")}
      </div>

      {/* Pagination Controls - Condensed */}
      {paginated && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-[10px] md:text-sm text-gray-500 dark:text-gray-400">
            {isServerPaginated
              ? `Page ${currentPage} of ${totalPages}`
              : totalRows === 0
                ? "Showing 0 of 0"
                : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalRows)} of ${totalRows}`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            >
              Prev
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(
                1,
                Math.min(currentPage - 2, totalPages - 4),
              );
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <Button
                  key={p}
                  variant={p === currentPage ? "primary" : "secondary"}
                  className="min-w-11"
                  aria-current={p === currentPage ? "page" : undefined}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() =>
                handlePageChange(Math.min(totalPages, currentPage + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
