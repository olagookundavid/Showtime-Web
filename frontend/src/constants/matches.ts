// The fixed knockout stages, in playing order. `value` is what's stored in the
// match's `round`; `label` is what the admin picks in the form.
export const KNOCKOUT_STAGES = [
  { value: "Wildcard", label: "Wildcard" },
  { value: "Playoff 1", label: "Playoffs 1" },
  { value: "Playoff 2", label: "Playoffs 2" },
  { value: "Bowl", label: "Bowl — Final" },
] as const;
