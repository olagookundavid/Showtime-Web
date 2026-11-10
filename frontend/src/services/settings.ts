import api from "./client";
import type { AppSettingsData } from "../types";

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
};
