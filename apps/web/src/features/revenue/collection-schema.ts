import { type DepartmentName, departments, type PaymentKind } from "@eyeflow/shared";
import { z } from "zod";
import { isoDateSchema } from "./collection-query";

export const creditProviders = ["CGHS", "ECHS", "Star Health", "Medi Assist", "Other"] as const;
export const onlineModes = ["UPI", "Card", "NEFT", "RTGS", "Other"] as const;

const amountSchema = z.number().min(0).max(10_000_000);

export const newPaymentLineSchema = z
  .object({
    amount: z.number().positive().max(10_000_000),
    department: z.enum(departments),
    discount: amountSchema,
    mode: z.enum(["cash", "credit", "online"]),
    providerOrMode: z.string().trim().max(120).nullable(),
  })
  .refine((value) => value.discount <= value.amount, {
    message: "Discount cannot exceed the payment amount",
    path: ["discount"],
  })
  .refine((value) => value.mode === "cash" || Boolean(value.providerOrMode), {
    message: "Choose a provider or payment mode",
    path: ["providerOrMode"],
  });

export const collectionBatchSchema = z.object({
  occurredOn: isoDateSchema,
  patient: z.string().trim().min(2).max(120),
  payments: z.array(newPaymentLineSchema).min(1, "Add at least one payment"),
});

export type NewCollectionBatch = z.infer<typeof collectionBatchSchema>;
export type NewPaymentLine = z.infer<typeof newPaymentLineSchema>;

export const editCollectionSchema = z
  .object({
    amount: z.number().positive().max(10_000_000),
    discount: amountSchema,
    id: z.string().uuid(),
    providerOrMode: z.string().trim().max(120).nullable(),
  })
  .refine((value) => value.discount <= value.amount, {
    message: "Discount cannot exceed the amount",
    path: ["discount"],
  });

export type EditCollection = z.infer<typeof editCollectionSchema>;

export const patientCollectionUpdateSchema = z
  .object({
    amount: z.number().positive().max(10_000_000),
    department: z.enum(departments),
    discount: amountSchema,
    id: z.string().uuid(),
    mode: z.enum(["cash", "credit", "online"]),
    providerOrMode: z.string().trim().max(120).nullable(),
  })
  .refine((value) => value.discount <= value.amount, {
    message: "Discount cannot exceed the amount",
    path: ["discount"],
  })
  .refine((value) => value.mode === "cash" || Boolean(value.providerOrMode), {
    message: "Provider or payment mode is required",
    path: ["providerOrMode"],
  });

export const patientWorkspaceUpdateSchema = z
  .object({
    collections: z.array(patientCollectionUpdateSchema).min(1),
    customerId: z.string().uuid(),
    patient: z.string().trim().min(2).max(120),
    reason: z.string().trim().min(3).max(240),
  })
  .refine(
    (value) =>
      new Set(value.collections.map((collection) => collection.id)).size ===
      value.collections.length,
    { message: "A collection may be updated only once", path: ["collections"] },
  );

export type PatientWorkspaceUpdate = z.infer<typeof patientWorkspaceUpdateSchema>;
export type PatientCollectionUpdate = z.infer<typeof patientCollectionUpdateSchema>;

export function emptyPaymentLine(department: DepartmentName): NewPaymentLine {
  return {
    amount: 0,
    department,
    discount: 0,
    mode: "cash",
    providerOrMode: null,
  };
}

export const paymentModeLabels = {
  cash: "Cash",
  credit: "Credit",
  online: "Online",
} as const satisfies Record<PaymentKind, string>;
