export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  /** An HTTP verb for something a person did, or a name like CONTRACT_EXPIRED for something the platform did itself. */
  action: string;
  /** The request path for a person's action; the kind of record for a system event. */
  entity_type: string;
  entity_id: string | null;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogParams {
  search?: string;
  user_id?: string;
  action?: string;
  /** "system" keeps only what the platform did on its own. */
  source?: "system";
  /** A date (2026-11-08) or a full timestamp. `to` as a date includes that whole day. */
  from?: string;
  to?: string;
  include_noise?: boolean;
  page?: number;
  limit?: number;
}

export interface AuditLogPage {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
