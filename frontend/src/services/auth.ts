import api from './client';
import type { AuthUser, ResetPasswordPayload } from '../types';

interface AuthApiResponse {
  message: string;
  data: AuthUser;
}

// Auth API functions
export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const response = await api.post<AuthApiResponse>("/auth/login", {
    email,
    password,
  });
  return response.data.data;
};

export const registerUser = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<void> => {
  await api.post("/auth/register", {
    first_name: firstName,
    last_name: lastName,
    email,
    password: password,
  });
};

export const logoutUser = async (): Promise<void> => {
  await api.post("/auth/logout");
};

export const getUserProfile = async (): Promise<AuthUser> => {
  const response = await api.get<AuthApiResponse>("/auth/profile");
  return response.data.data;
};

/** Emails the logged-in user a 6-digit code to verify their address. */
export const sendEmailVerificationCode = async (): Promise<void> => {
  await api.post("/auth/verify-email/send");
};

/** Confirms the emailed code; the account is then verified. */
export const confirmEmailVerification = async (code: string): Promise<void> => {
  await api.post("/auth/verify-email/confirm", { code });
};

export const updateOwnProfile = async (
  firstName: string,
  lastName: string,
  phone: string,
): Promise<void> => {
  await api.put("/auth/profile", {
    first_name: firstName,
    last_name: lastName,
    phone,
  });
};

export const forgotPassword = async (email: string): Promise<void> => {
  await api.post("/auth/forgot-password", { email });
};

export const resetPassword = async (
  payload: ResetPasswordPayload,
): Promise<void> => {
  await api.post("/auth/reset-password", payload);
};
