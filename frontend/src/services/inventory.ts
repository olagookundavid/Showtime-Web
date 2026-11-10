import api from "./client";
import type {
  GenericApiResponse,
  InventoryProduct,
  InventorySale,
  SalesReportResponse,
  PaymentMethod,
} from "../types";

export const getAdminProducts = async (
  page = 1,
  limit = 20,
  search?: string,
  activeOnly?: boolean,
) => {
  let url = `/admin/inventory/products?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (activeOnly) url += `&active_only=true`;
  const response = await api.get<{
    message: string;
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminLowStockAlerts = async () => {
  const response = await api.get<GenericApiResponse<InventoryProduct[]>>(
    `/admin/inventory/low-stock`,
  );
  return response.data.data;
};

export const createAdminProduct = async (payload: {
  name: string;
  description: string;
  price: number;
  quantity: number;
  threshold: number;
}) => {
  const response = await api.post<GenericApiResponse<InventoryProduct>>(
    `/admin/inventory/products`,
    payload,
  );
  return response.data;
};

export const updateAdminProduct = async (
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
  }>,
) => {
  const response = await api.put<GenericApiResponse<InventoryProduct>>(
    `/admin/inventory/products/${id}`,
    payload,
  );
  return response.data;
};

export const deleteAdminProduct = async (id: string) => {
  const response = await api.delete(`/admin/inventory/products/${id}`);
  return response.data;
};

export const getAdminSales = async (
  page = 1,
  limit = 20,
  productId?: string,
  sellerId?: string,
  fromDate?: string,
  toDate?: string,
) => {
  let url = `/admin/inventory/sales?page=${page}&limit=${limit}`;
  if (productId) url += `&product_id=${productId}`;
  if (sellerId) url += `&seller_id=${sellerId}`;
  if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
  if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
  const response = await api.get<{
    message: string;
    data: InventorySale[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminSalesReport = async (
  period: "daily" | "weekly" | "monthly" | "custom",
  fromDate?: string,
  toDate?: string,
) => {
  let url = `/admin/inventory/reports?period=${period}`;
  if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
  if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
  const response = await api.get<GenericApiResponse<SalesReportResponse>>(url);
  return response.data.data;
};

export const getAdminPaymentMethods = async (activeOnly = false) => {
  let url = `/admin/inventory/payment-methods`;
  if (activeOnly) url += `?active_only=true`;
  const response = await api.get<GenericApiResponse<PaymentMethod[]>>(url);
  return response.data.data;
};

export const createAdminPaymentMethod = async (name: string) => {
  const response = await api.post<GenericApiResponse<PaymentMethod>>(
    `/admin/inventory/payment-methods`,
    { name },
  );
  return response.data;
};

export const toggleAdminPaymentMethod = async (
  id: string,
  isActive: boolean,
) => {
  const response = await api.patch<GenericApiResponse<null>>(
    `/admin/inventory/payment-methods/${id}/toggle`,
    { is_active: isActive },
  );
  return response.data;
};

export const sellerGetProducts = async (
  page = 1,
  limit = 50,
  search?: string,
) => {
  let url = `/seller/products?page=${page}&limit=${limit}&active_only=true`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const response = await api.get<{
    message: string;
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const sellerLogSale = async (payload: {
  product_id: string;
  quantity_sold: number;
  payment_method: string;
  notes: string;
}) => {
  const response = await api.post<GenericApiResponse<InventorySale>>(
    `/seller/sales`,
    payload,
  );
  return response.data;
};

export const sellerGetSales = async (
  page = 1,
  limit = 20,
  fromDate?: string,
  toDate?: string,
) => {
  let url = `/seller/sales?page=${page}&limit=${limit}`;
  if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
  if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
  const response = await api.get<{
    message: string;
    data: InventorySale[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const sellerGetPaymentMethods = async () => {
  const response = await api.get<GenericApiResponse<PaymentMethod[]>>(
    `/seller/payment-methods?active_only=true`,
  );
  return response.data.data;
};
