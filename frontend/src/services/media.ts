import api from './client';
import type {
  MediaFile,
  PresignMediaPayload,
  PresignMediaResult,
  CreateMediaPayload,
  ReplaceMediaPayload,
} from '../types';

// Files in R2 at fixed URLs. Upload with `useMediaUpload`, which presigns, PUTs the
// file straight to R2, then creates or replaces the record.
export const getMediaFiles = async (): Promise<MediaFile[]> => {
  const response = await api.get<{ data: MediaFile[] }>("/admin/media");
  return response.data.data || [];
};

export const presignMediaUpload = async (payload: PresignMediaPayload): Promise<PresignMediaResult> => {
  const response = await api.post<{ data: PresignMediaResult }>("/admin/media/presign", payload);
  return response.data.data;
};

export const createMediaFile = async (payload: CreateMediaPayload): Promise<MediaFile> => {
  const response = await api.post<{ data: MediaFile }>("/admin/media", payload);
  return response.data.data;
};

export const replaceMediaFile = async (id: string, payload: ReplaceMediaPayload): Promise<MediaFile> => {
  const response = await api.put<{ data: MediaFile }>(`/admin/media/${id}/file`, payload);
  return response.data.data;
};

export const updateMediaFile = async (id: string, title: string) => {
  const response = await api.put(`/admin/media/${id}`, { title });
  return response.data;
};

export const deleteMediaFile = async (id: string) => {
  const response = await api.delete(`/admin/media/${id}`);
  return response.data;
};
