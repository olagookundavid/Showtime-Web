import api from './client';

export const getAdminUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
};

export const updateUserInfo = async (
  userId: string,
  payload: { firstName: string; lastName: string; phone: string },
) => {
  const response = await api.put(`/admin/users/${userId}`, {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
  });
  return response.data;
};
