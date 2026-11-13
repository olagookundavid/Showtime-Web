import api from "./client";
import type {
  AdminSettings,
  AppSettingsData,
  ContractSettings,
  FantasySettings,
  NotificationSettingsPayload,
  SettingsUser,
} from "../types";

// Site-wide display settings. The read is public (every visitor needs the app
// font on boot); only an admin can write, which is what makes the choice apply
// to everyone rather than just the browser that made it.
export const appSettingsApi = {
  get: async (): Promise<AppSettingsData> => {
    const res = await api.get<AppSettingsData>("/app-settings");
    return res.data;
  },
  setFont: async (app_font_id: string): Promise<AppSettingsData> => {
    const res = await api.put<AppSettingsData>("/admin/app-settings/font", {
      app_font_id,
    });
    return res.data;
  },
  /** Everything the App Settings page edits. */
  getAdmin: async (): Promise<AdminSettings> => {
    const res = await api.get<AdminSettings>("/admin/app-settings");
    return res.data;
  },
  saveContracts: async (data: ContractSettings): Promise<AdminSettings> => {
    const res = await api.put<AdminSettings>("/admin/app-settings/contracts", data);
    return res.data;
  },
  saveNotifications: async (data: NotificationSettingsPayload): Promise<AdminSettings> => {
    const res = await api.put<AdminSettings>("/admin/app-settings/notifications", data);
    return res.data;
  },
  saveFantasy: async (data: FantasySettings): Promise<AdminSettings> => {
    const res = await api.put<AdminSettings>("/admin/app-settings/fantasy", data);
    return res.data;
  },
  /** Staff who could be chosen to receive the league summary. */
  searchStaff: async (search: string): Promise<SettingsUser[]> => {
    const res = await api.get<{ data: SettingsUser[] }>("/admin/app-settings/staff", { params: { search } });
    return res.data.data || [];
  },
};
