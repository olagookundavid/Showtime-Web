import api from "./client";
import type { AuditLogPage, AuditLogParams } from "../types";

export const auditApi = {
  list: async (params: AuditLogParams): Promise<AuditLogPage> => {
    const res = await api.get<AuditLogPage>("/admin/audit-logs", { params });
    return res.data;
  },
};
