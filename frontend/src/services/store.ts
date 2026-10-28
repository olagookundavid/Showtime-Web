import api from "./client";
import type {
  StoreProduct,
  CheckoutPayload,
  CheckoutResponseData,
  Order,
  SavedAddress,
  PaginatedResponse,
  ProductOption,
  AdminVariantPayload,
  ProductImage,
  ProductReview,
  CreateProductReviewPayload,
  ReviewSort,
} from "../types";

export const getStoreProducts = async (): Promise<StoreProduct[]> => {
  const response = await api.get<{ data: StoreProduct[] }>("/store/products");
  return response.data.data || [];
};

export const getStoreProduct = async (id: string): Promise<StoreProduct> => {
  const response = await api.get<{ data: StoreProduct }>(
    `/store/products/${id}`,
  );
  return response.data.data;
};

export const initializeCheckout = async (
  payload: CheckoutPayload,
): Promise<CheckoutResponseData> => {
  const response = await api.post<{ data: CheckoutResponseData }>(
    "/store/checkout",
    payload,
  );
  return response.data.data;
};

export const verifyStorePayment = async (reference: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>("/store/verify", {
    reference,
  });
  return response.data.data;
};

export const getOrderByReference = async (
  reference: string,
): Promise<Order> => {
  const response = await api.get<{ data: Order }>(
    `/store/orders/by-ref/${reference}`,
  );
  return response.data.data;
};

export const getSavedAddresses = async (): Promise<SavedAddress[]> => {
  const response = await api.get<{ data: SavedAddress[] }>("/store/addresses");
  return response.data.data || [];
};

export const saveSavedAddress = async (
  payload: Omit<SavedAddress, "id">,
): Promise<SavedAddress> => {
  const response = await api.post<{ data: SavedAddress }>(
    "/store/addresses",
    payload,
  );
  return response.data.data;
};

export const getCustomerOrders = async (
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Order>> => {
  const response = await api.get<PaginatedResponse<Order>>(
    `/store/orders?page=${page}&limit=${limit}`,
  );
  return response.data;
};

// Admin E-commerce Storefront APIs
export const getAdminStoreProducts = async (): Promise<StoreProduct[]> => {
  const response = await api.get<{ data: StoreProduct[] }>(
    "/admin/store/products",
  );
  return response.data.data || [];
};

type AdminStoreProductPayload = Omit<
  StoreProduct,
  | "id"
  | "sku"
  | "created_at"
  | "updated_at"
  | "images"
  | "variants"
  | "options"
  | "rating_avg"
  | "rating_count"
  | "created_by_name"
> & {
  sku?: string;
  options: ProductOption[];
};

export const createAdminStoreProduct = async (
  payload: AdminStoreProductPayload,
): Promise<StoreProduct> => {
  const response = await api.post<{ data: StoreProduct }>(
    "/admin/store/products",
    payload,
  );
  return response.data.data;
};

export const updateAdminStoreProduct = async (
  id: string,
  payload: AdminStoreProductPayload,
): Promise<unknown> => {
  const response = await api.put(`/admin/store/products/${id}`, payload);
  return response.data;
};

export const deleteAdminStoreProduct = async (id: string): Promise<unknown> => {
  const response = await api.delete(`/admin/store/products/${id}`);
  return response.data;
};

export const getAdminOrders = async (
  page = 1,
  limit = 20,
  paymentStatus?: string,
  fulfillmentStatus?: string,
): Promise<{
  data: Order[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  let url = `/admin/store/orders?page=${page}&limit=${limit}`;
  if (paymentStatus) url += `&payment_status=${paymentStatus}`;
  if (fulfillmentStatus) url += `&fulfillment_status=${fulfillmentStatus}`;
  const response = await api.get<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(url);
  return response.data;
};

export const getAdminOrder = async (id: string): Promise<Order> => {
  const response = await api.get<{ data: Order }>(`/admin/store/orders/${id}`);
  return response.data.data;
};

export const updateOrderFulfillment = async (
  id: string,
  fulfillmentStatus: string,
): Promise<Order> => {
  const response = await api.patch<{ data: Order }>(
    `/admin/store/orders/${id}/fulfillment`,
    { fulfillment_status: fulfillmentStatus },
  );
  return response.data.data;
};

export const verifyAdminStoreOrder = async (id: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>(
    `/admin/store/orders/${id}/verify`,
  );
  return response.data.data;
};

export const cancelAdminStoreOrder = async (id: string): Promise<Order> => {
  const response = await api.post<{ data: Order }>(
    `/admin/store/orders/${id}/cancel`,
  );
  return response.data.data;
};

export const saveAdminProductVariants = async (
  productId: string,
  variants: AdminVariantPayload[],
): Promise<unknown> => {
  const response = await api.post(
    `/admin/store/products/${productId}/variants`,
    variants,
  );
  return response.data;
};

export const saveAdminProductImages = async (
  productId: string,
  images: Omit<ProductImage, "id">[],
): Promise<unknown> => {
  const response = await api.post(
    `/admin/store/products/${productId}/images`,
    images,
  );
  return response.data;
};

export const getProductReviews = async (
  productId: string,
  page = 1,
  limit = 10,
  sort: ReviewSort = "newest",
): Promise<{
  data: ProductReview[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  const response = await api.get<{
    data: ProductReview[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(
    `/store/products/${productId}/reviews?page=${page}&limit=${limit}&sort=${sort}`,
  );
  return response.data;
};

export const createProductReview = async (
  productId: string,
  payload: CreateProductReviewPayload,
): Promise<ProductReview> => {
  const response = await api.post<{ data: ProductReview }>(
    `/store/products/${productId}/reviews`,
    payload,
  );
  return response.data.data;
};

export const getMyProductReview = async (
  productId: string,
): Promise<ProductReview | null> => {
  const response = await api.get<{ data: ProductReview | null }>(
    `/store/products/${productId}/reviews/mine`,
  );
  return response.data.data;
};

export const deleteAdminProductReview = async (id: string): Promise<unknown> => {
  const response = await api.delete(`/admin/store/reviews/${id}`);
  return response.data;
};
