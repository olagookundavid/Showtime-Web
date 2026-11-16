import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowDownTrayIcon,
  CheckIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  DashboardPageHeader,
  DataTable,
  Field,
  MetricCard,
  Select,
  type Column,
} from "../../components";
import {
  adminListLeads,
  downloadLeadsExport,
  getLeadSummary,
} from "../../services";
import { LEAD_INTERESTS, LEAD_SHARE_CHANNELS, leadInterestLabel } from "../../constants";
import { getApiErrorMessage } from "../../utils";
import type { LeadInterest, LeadResponse, LeadSourceStat } from "../../types";

const PAGE_SIZE = 20;
const NO_LEADS: LeadResponse[] = [];
const NO_SOURCES: LeadSourceStat[] = [];

const joinedLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

const sourceLabel = (source: string) =>
  source.charAt(0).toUpperCase() + source.slice(1);

const SOURCE_COLUMNS: Column<LeadSourceStat>[] = [
  {
    header: "Channel",
    sortable: true,
    sortValue: (s) => s.source,
    cell: (s) => (
      <span className="font-bold text-sffl-navy dark:text-white">
        {sourceLabel(s.source)}
      </span>
    ),
  },
  { header: "Leads", align: "right", sortable: true, sortValue: (s) => s.leads, cell: (s) => s.leads },
  { header: "Bought a ticket", align: "right", sortable: true, sortValue: (s) => s.converted, cell: (s) => s.converted },
  {
    header: "Share",
    align: "right",
    sortable: true,
    sortValue: (s) => (s.leads > 0 ? s.converted / s.leads : 0),
    cell: (s) => (
      <span className="font-bold text-green-700 dark:text-green-400">
        {percent(s.converted, s.leads)}
      </span>
    ),
  },
];

const LEAD_COLUMNS: Column<LeadResponse>[] = [
  {
    header: "Name",
    sortable: true,
    sortValue: (l) => l.name,
    cell: (l) => (
      <div className="min-w-0">
        <p className="font-bold text-sffl-navy dark:text-white">{l.name}</p>
        <p className="break-all text-xs text-gray-500 dark:text-gray-400">{l.email}</p>
      </div>
    ),
  },
  { header: "Phone", cell: (l) => <span className="whitespace-nowrap">{l.phone}</span> },
  {
    header: "Interested in",
    cell: (l) => (
      <div className="flex flex-wrap gap-1">
        {l.interests.map((i) => (
          <span
            key={i}
            className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            {leadInterestLabel(i)}
          </span>
        ))}
      </div>
    ),
  },
  {
    header: "Source",
    sortable: true,
    sortValue: (l) => l.source,
    cell: (l) => sourceLabel(l.source),
  },
  {
    header: "Joined",
    sortable: true,
    sortValue: (l) => l.created_at,
    cell: (l) => <span className="whitespace-nowrap text-sm">{joinedLabel(l.created_at)}</span>,
  },
  {
    header: "Bought a ticket",
    sortable: true,
    sortValue: (l) => (l.bought_ticket ? 1 : 0),
    cell: (l) =>
      l.bought_ticket ? (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800 dark:bg-green-900/40 dark:text-green-300">
          Yes
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
];

/** One shareable link for a channel, with a copy button. */
const ShareLink = ({ channel }: { channel: string }) => {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/join?src=${channel}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Select it and copy it by hand.");
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-24 shrink-0 text-sm font-bold text-gray-800 dark:text-gray-200">
        {sourceLabel(channel)}
      </span>
      <span className="min-w-0 flex-1 break-all text-sm text-gray-600 dark:text-gray-300">{url}</span>
      <Button
        size="sm"
        variant={copied ? "success" : "secondary"}
        icon={copied ? CheckIcon : DocumentDuplicateIcon}
        onClick={copy}
        aria-label={`Copy the ${channel} link`}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </li>
  );
};

export const AdminLeads = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [interest, setInterest] = useState<LeadInterest | "">("");
  const [bought, setBought] = useState<"yes" | "no" | "">("");
  const [exporting, setExporting] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["leadSummary"],
    queryFn: getLeadSummary,
  });
  const sources = summary?.sources ?? NO_SOURCES;

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminLeads", { page, search, source, interest, bought }],
    queryFn: () =>
      adminListLeads({ page, limit: PAGE_SIZE, search, source, interest, bought }),
    placeholderData: (prev) => prev,
  });
  const leads = data?.data ?? NO_LEADS;

  const columns = useMemo(() => LEAD_COLUMNS, []);

  const resetPage = () => setPage(1);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadLeadsExport({ search, source, interest, bought });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not download the leads."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Leads"
        subtitle="People who asked to hear about Showtime game days through the join page."
        actions={
          <Button
            variant="secondary"
            icon={ArrowDownTrayIcon}
            loading={exporting}
            onClick={handleExport}
          >
            Download CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Leads" value={(summary?.total ?? 0).toLocaleString()} hint="People on the list" />
        <MetricCard label="Bought a ticket" value={(summary?.converted ?? 0).toLocaleString()} hint="Paid for a ticket after joining" />
        <MetricCard
          tone="highlight"
          label="Turned into sales"
          value={percent(summary?.converted ?? 0, summary?.total ?? 0)}
          hint="Bought ÷ leads"
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <h2 className="text-xl font-black text-sffl-navy dark:text-white">Links to share</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
          Give each channel its own link. The link remembers where a lead came from, so you can see which channel
          brings people who buy.
        </p>
        <ul className="space-y-3">
          <ShareLink channel="direct" />
          {LEAD_SHARE_CHANNELS.map((channel) => (
            <ShareLink key={channel} channel={channel} />
          ))}
        </ul>
      </section>

      {sources.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <h2 className="mb-3 text-xl font-black text-sffl-navy dark:text-white">Leads by channel</h2>
          <DataTable
            data={sources}
            columns={SOURCE_COLUMNS}
            searchable={false}
            paginated={false}
            getRowId={(s) => s.source}
            emptyMessage="No leads yet."
          />
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400">
          {getApiErrorMessage(error, "Failed to load leads.")}
        </div>
      )}

      <DataTable
        data={leads}
        columns={columns}
        loading={isLoading}
        getRowId={(l) => l.id}
        searchPlaceholder="Search by name, email or phone"
        serverPage={page}
        totalServerPages={data?.total_pages || 1}
        onPageChange={setPage}
        itemsPerPage={PAGE_SIZE}
        onSearchSubmit={(term) => {
          setSearch(term);
          resetPage();
        }}
        emptyMessage="No leads match. Share the join link above to start collecting them."
        headerActions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Field label="Channel" htmlFor="leads-source">
              <Select
                id="leads-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  resetPage();
                }}
              >
                <option value="">All channels</option>
                {sources.map((s) => (
                  <option key={s.source} value={s.source}>
                    {sourceLabel(s.source)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Interested in" htmlFor="leads-interest">
              <Select
                id="leads-interest"
                value={interest}
                onChange={(e) => {
                  setInterest(e.target.value as LeadInterest | "");
                  resetPage();
                }}
              >
                <option value="">Anything</option>
                {LEAD_INTERESTS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bought a ticket" htmlFor="leads-bought">
              <Select
                id="leads-bought"
                value={bought}
                onChange={(e) => {
                  setBought(e.target.value as "yes" | "no" | "");
                  resetPage();
                }}
              >
                <option value="">Everyone</option>
                <option value="yes">Bought</option>
                <option value="no">Not yet</option>
              </Select>
            </Field>
          </div>
        }
      />
    </div>
  );
};

export default AdminLeads;
