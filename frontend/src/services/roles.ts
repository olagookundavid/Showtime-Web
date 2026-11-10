import api from './client';
import type {
  RoleResponse,
  RoleOption,
  FeatureDef,
  SaveRolePayload,
} from '../types';

export const getAdminRoles = async (): Promise<RoleResponse[]> => {
  const response = await api.get<{ data: RoleResponse[] }>("/admin/roles");
  return response.data.data || [];
};

export const getAdminRoleFeatures = async (): Promise<FeatureDef[]> => {
  const response = await api.get<{ data: FeatureDef[] }>("/admin/roles/features");
  return response.data.data || [];
};

/** Roles for a dropdown. Needs only user-management access, not the Roles page. */
export const getAdminRoleOptions = async (): Promise<RoleOption[]> => {
  const response = await api.get<{ data: RoleOption[] }>("/admin/users/roles");
  return response.data.data || [];
};

export const createAdminRole = async (
  payload: SaveRolePayload,
): Promise<RoleResponse> => {
  const response = await api.post<{ data: RoleResponse }>("/admin/roles", payload);
  return response.data.data;
};

export const updateAdminRole = async (
  key: string,
  payload: SaveRolePayload,
): Promise<RoleResponse> => {
  const response = await api.put<{ data: RoleResponse }>(
    `/admin/roles/${key}`,
    payload,
  );
  return response.data.data;
};

export const deleteAdminRole = async (key: string) => {
  const response = await api.delete(`/admin/roles/${key}`);
  return response.data;
};
