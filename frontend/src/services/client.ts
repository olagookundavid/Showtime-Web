import axios from "axios";
import { API_URL } from "../constants";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Remove withCredentials since we are using Bearer tokens now
});

// Interceptor to attach the token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("showtime_access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler: when a LOGGED-IN user's token expires/goes invalid, clear
// it and send them to login. Critically, this must NOT fire for anonymous
// visitors — that was the bug where a brand-new visitor hit the login page on
// load. An anon user legitimately gets 401s from authenticated calls (e.g. the
// session probe /auth/profile on load, or saved-addresses on the store). So we
// only act when a token was actually present (a real session that went bad),
// and we skip the auth endpoints (login/register/reset have their own forms,
// /auth/profile is the anon session probe).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    const hadToken =
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem("showtime_access_token");
    // The claim endpoints answer 401 for a bad/expired/exhausted team code, which
    // says nothing about the caller's session. A claimant is signed in as
    // player_pending while they finish their claim, so treating that 401 as an
    // expired session would sign them out mid-flow.
    const isAuthEndpoint =
      /\/auth\/(login|register|forgot-password|reset-password|profile)|\/claim\//.test(
        url,
      );
    if (status === 401 && hadToken && !isAuthEndpoint) {
      localStorage.removeItem("showtime_access_token");
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

export default api;
