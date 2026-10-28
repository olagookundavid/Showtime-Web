import api from "./client";
import type {
  DiscountCode,
  SaveDiscountCodePayload,
  DiscountTarget,
  DiscountPreview,
  CheckoutItemPayload,
} from "../types";

export const discountsApi = {
  list: async (): Promise<DiscountCode[]> => {
    const res = await api.get<{ data: DiscountCode[] }>(
      "/admin/discount-codes",
    );
    return res.data.data || [];
  },
  listTargets: async (search?: string): Promise<DiscountTarget[]> => {
    // Filtered on the server: a catalogue outgrows any page, so searching
    // the loaded page would quietly hide anything past it.
    const res = await api.get<{ data: DiscountTarget[] }>(
      "/admin/discount-codes/targets",
      {
        params: { search: search || undefined, limit: 50 },
      },
    );
    return res.data.data || [];
  },
  create: async (payload: SaveDiscountCodePayload): Promise<DiscountCode> => {
    const res = await api.post<{ data: DiscountCode }>(
      "/admin/discount-codes",
      payload,
    );
    return res.data.data;
  },
  update: async (
    id: string,
    payload: SaveDiscountCodePayload,
  ): Promise<DiscountCode> => {
    const res = await api.put<{ data: DiscountCode }>(
      `/admin/discount-codes/${id}`,
      payload,
    );
    return res.data.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/admin/discount-codes/${id}`);
  },

  /**
   * Asks the server what a code would do. The cart is re-priced server-side
   * through the same path checkout uses, so the saving shown is the saving
   * charged. Never applies the code — that happens at checkout.
   */
  preview: async (params: {
    code: string;
    items?: CheckoutItemPayload[];
    product_id?: string;
    event_day_id?: string;
    quantity?: number;
  }): Promise<DiscountPreview> => {
    const res = await api.post<DiscountPreview>("/discounts/preview", params);
    return res.data;
  },
};
