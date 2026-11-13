import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { EyeIcon } from "@heroicons/react/24/outline";
import {
  Checkbox,
  DashboardPageHeader,
  DataTable,
  Input,
  Modal,
  RowActions,
  Select,
  type Column,
} from "../../components";
import { auditApi } from "../../services";
import type { AuditLogEntry } from "../../types";

const HTTP_VERBS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);

const isSystemEvent = (e: AuditLogEntry) => !HTTP_VERBS.has(e.action);

const VERB_LABEL: Record<string, string> = {
  POST: "Created / ran",
  PUT: "Updated",
  PATCH: "Updated",
  DELETE: "Deleted",
};

const actionBadgeClass = (e: AuditLogEntry): string => {
  if (isSystemEvent(e)) {
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  }
  switch (e.action) {
    case "POST":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "PUT":
    case "PATCH":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "DELETE":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** `/api/v1/admin/players/3f2a…` → `admin/players/3f2a1c9b…`: readable, and still searchable by the id's start. */
const shortPath = (path: string) =>
  path.replace(/^\/api\/v1\//, "").replace(UUID, (id) => `${id.slice(0, 8)}…`);

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/** One line saying what happened. System events carry their own sentence; for a request we name the person or thing edited. */
const describe = (e: AuditLogEntry): string => {
  const d = e.details ?? {};
  const summary = str(d.summary) ?? str(d.note);
  if (summary) return summary;

  const body = (d.request_body ?? {}) as Record<string, unknown>;
  const subject = str(body.name) ?? str(body.title) ?? str(body.email);
  const verb = VERB_LABEL[e.action] ?? e.action;
  const target = shortPath(e.entity_type);
  return subject ? `${verb} ${target} — ${subject}` : `${verb} ${target}`;
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "POST", label: "Created / ran" },
  { value: "PUT", label: "Updated (PUT)" },
  { value: "PATCH", label: "Updated (PATCH)" },
  { value: "DELETE", label: "Deleted" },
  { value: "system", label: "Done by the system" },
];

export const AdminAuditLog = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeNoise, setIncludeNoise] = useState(false);

  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        search: search || undefined,
        action: action && action !== "system" ? action : undefined,
        source: action === "system" ? "system" : undefined,
        from: from || undefined,
        to: to || undefined,
        include_noise: includeNoise || undefined,
        page,
        limit,
      });
      setEntries(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch {
      toast.error("Failed to load the audit trail");
    } finally {
      setLoading(false);
    }
  }, [search, action, from, to, includeNoise, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo<Column<AuditLogEntry>[]>(
    () => [
      {
        header: "What happened",
        className: "min-w-[12rem] max-w-[16rem] sm:max-w-[24rem]",
        cell: (e) => (
          <div className="min-w-0">
            <p className="text-sm text-gray-900 dark:text-white break-words line-clamp-3">{describe(e)}</p>
            {e.details?.status_code !== undefined && Number(e.details.status_code) >= 400 && (
              <p className="text-xs font-bold text-red-600 dark:text-red-400">
                Failed ({String(e.details.status_code)})
              </p>
            )}
          </div>
        ),
      },
      {
        header: "When",
        className: "whitespace-nowrap text-xs text-gray-600 dark:text-gray-300",
        cell: (e) => formatWhen(e.created_at),
      },
      {
        header: "Who",
        cell: (e) =>
          e.user_id ? (
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-white truncate">
                {e.user_name || e.user_email || "Unknown user"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {e.user_email}
                {e.user_role ? ` · ${e.user_role}` : ""}
              </p>
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {isSystemEvent(e) ? "System (automatic)" : "Not signed in"}
            </span>
          ),
      },
      {
        header: "Action",
        cell: (e) => (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${actionBadgeClass(e)}`}
          >
            {isSystemEvent(e) ? e.action.replace(/_/g, " ") : (VERB_LABEL[e.action] ?? e.action)}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (e) => (
          <RowActions
            label={`Actions for ${describe(e)}`}
            actions={[
              {
                label: "View details",
                icon: EyeIcon,
                onSelect: () => setSelected(e),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Audit Trail"
        subtitle="Who changed what, and what the platform did on its own, such as contracts expiring. Newest first."
      />

      <DataTable
        data={entries}
        columns={columns}
        searchPlaceholder="Search a name, email, id or page..."
        itemsPerPage={limit}
        serverPage={page}
        totalServerPages={totalPages}
        onPageChange={setPage}
        onSearchSubmit={(term) => {
          setSearch(term);
          setPage(1);
        }}
        loading={loading}
        getRowId={(e) => e.id}
        onRowClick={setSelected}
        emptyMessage="Nothing in the audit trail matches those filters."
        headerActions={
          <>
            <Select
              aria-label="Action"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-48"
            >
              {ACTION_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              aria-label="From date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-40"
            />
            <Select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full sm:w-36"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </Select>
            <Checkbox
              label="Include routine noise"
              hint="Health checks and anonymous logins"
              checked={includeNoise}
              onChange={(e) => {
                setIncludeNoise(e.target.checked);
                setPage(1);
              }}
            />
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {total.toLocaleString()} event{total === 1 ? "" : "s"}
            </span>
          </>
        }
      />

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? describe(selected) : ""}
        subtitle={selected ? formatWhen(selected.created_at) : undefined}
        maxWidth="2xl"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
              <dt className="font-bold text-gray-500 dark:text-gray-400">Who</dt>
              <dd className="text-gray-900 dark:text-white break-words">
                {selected.user_id
                  ? `${selected.user_name ?? ""} ${selected.user_email ? `<${selected.user_email}>` : ""} · ${selected.user_role ?? "unknown role"}`
                  : isSystemEvent(selected)
                    ? "System (automatic)"
                    : "Not signed in"}
              </dd>
              <dt className="font-bold text-gray-500 dark:text-gray-400">Action</dt>
              <dd className="text-gray-900 dark:text-white">{selected.action}</dd>
              <dt className="font-bold text-gray-500 dark:text-gray-400">Target</dt>
              <dd className="text-gray-900 dark:text-white break-all">
                {selected.entity_type}
                {selected.entity_id ? ` · ${selected.entity_id}` : ""}
              </dd>
            </dl>
            <pre className="max-h-[50dvh] overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
              {JSON.stringify(selected.details ?? {}, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};
