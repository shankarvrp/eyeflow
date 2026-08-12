import { z } from "zod";

export const opticalOrderStatuses = [
  "advanced",
  "ordered",
  "lens_arrived",
  "fitted",
  "ready",
  "delivered",
] as const;

export const opticalOrderStatusSchema = z.enum(opticalOrderStatuses);
export type OpticalOrderStatus = z.infer<typeof opticalOrderStatusSchema>;

export const opticalOrderStatusLabels: Record<OpticalOrderStatus, string> = {
  advanced: "Advanced",
  delivered: "Delivered",
  fitted: "In Fitting",
  lens_arrived: "Lens Arrived",
  ordered: "Ordered",
  ready: "Ready",
};

export const updateOpticalOrderSchema = z.object({
  orderKey: z.string().min(8).max(160),
  status: opticalOrderStatusSchema,
});

export type UpdateOpticalOrder = z.infer<typeof updateOpticalOrderSchema>;

export const updateOpticalOrderContactSchema = z.object({
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{7,18}$/, "Enter a valid mobile number."),
  expectedDeliveryDate: z.iso.date().optional(),
  orderKey: z.string().min(8).max(160),
});

export type UpdateOpticalOrderContact = z.infer<typeof updateOpticalOrderContactSchema>;

export interface OpticalOrder {
  collectedAmount: number;
  customerPhone: string | null;
  expectedDeliveryDate: string;
  isOverdue: boolean;
  orderDate: string;
  orderKey: string;
  patient: string;
  paymentCount: number;
  status: OpticalOrderStatus;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface OpticalTrackerData {
  overdueCount: number;
  orders: OpticalOrder[];
  summary: Array<{
    count: number;
    status: OpticalOrderStatus;
  }>;
  totalCollected: number;
  totalOrders: number;
}
