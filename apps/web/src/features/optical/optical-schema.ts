import { z } from "zod";

export const opticalOrderStatuses = [
  "walk_in",
  "advanced",
  "ordered",
  "lens_arrived",
  "fitted",
  "delivered",
] as const;

export const opticalOrderStatusSchema = z.enum(opticalOrderStatuses);
export type OpticalOrderStatus = z.infer<typeof opticalOrderStatusSchema>;

export const opticalOrderStatusLabels: Record<OpticalOrderStatus, string> = {
  advanced: "Advanced",
  delivered: "Delivered",
  fitted: "Fitted",
  lens_arrived: "Lens Arrived",
  ordered: "Ordered",
  walk_in: "Walk-In",
};

export const updateOpticalOrderSchema = z.object({
  orderKey: z.string().min(8).max(160),
  status: opticalOrderStatusSchema,
});

export type UpdateOpticalOrder = z.infer<typeof updateOpticalOrderSchema>;

export interface OpticalOrder {
  collectedAmount: number;
  orderDate: string;
  orderKey: string;
  patient: string;
  paymentCount: number;
  status: OpticalOrderStatus;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface OpticalTrackerData {
  orders: OpticalOrder[];
  summary: Array<{
    count: number;
    status: OpticalOrderStatus;
  }>;
  totalCollected: number;
  totalOrders: number;
}
