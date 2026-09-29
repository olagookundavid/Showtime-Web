/** A team's Active / Inactive status. Read-only: changing it is an action, not a click on the badge. */
export const TeamStatusBadge = ({ status }: { status?: string }) => {
  const inactive = status === "inactive";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border whitespace-nowrap ${
        inactive
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
      {inactive ? "Inactive" : "Active"}
    </span>
  );
};
