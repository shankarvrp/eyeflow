import { type DepartmentName, departments, type PaymentKind } from "@eyeflow/shared";
import { z } from "zod";

export const creditProviders = ["CGHS", "ECHS", "Star Health", "Medi Assist", "Other"] as const;
export const onlineModes = ["UPI", "Card", "NEFT", "RTGS", "Other"] as const;

const amountSchema = z.number().min(0).max(10_000_000);

export const departmentCollectionSchema = z
  .object({
    cash: amountSchema,
    credit: amountSchema,
    creditProvider: z.string().trim().max(120).nullable(),
    department: z.enum(departments),
    discount: amountSchema,
    online: amountSchema,
    onlineMode: z.string().trim().max(120).nullable(),
  })
  .refine((value) => value.discount <= value.cash + value.credit + value.online, {
    message: "Discount cannot exceed this department's total",
    path: ["discount"],
  })
  .refine((value) => value.credit === 0 || Boolean(value.creditProvider), {
    message: "Choose an insurance/provider",
    path: ["creditProvider"],
  })
  .refine((value) => value.online === 0 || Boolean(value.onlineMode), {
    message: "Choose an online payment mode",
    path: ["onlineMode"],
  });

export const collectionBatchSchema = z
  .object({
    departments: z.array(departmentCollectionSchema).min(1),
    patient: z.string().trim().min(2).max(120),
  })
  .refine(
    (value) =>
      value.departments.some(
        (department) => department.cash + department.credit + department.online > 0,
      ),
    {
      message: "Enter at least one payment",
      path: ["departments"],
    },
  )
  .refine(
    (value) =>
      new Set(value.departments.map((department) => department.department)).size ===
      value.departments.length,
    {
      message: "Each department may be submitted only once",
      path: ["departments"],
    },
  );

export type NewCollectionBatch = z.infer<typeof collectionBatchSchema>;
export type DepartmentCollection = z.infer<typeof departmentCollectionSchema>;

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

export function emptyDepartmentCollection(department: DepartmentName): DepartmentCollection {
  return {
    cash: 0,
    credit: 0,
    creditProvider: null,
    department,
    discount: 0,
    online: 0,
    onlineMode: null,
  };
}

export const paymentModeLabels = {
  cash: "Cash",
  credit: "Credit",
  online: "Online",
} as const satisfies Record<PaymentKind, string>;
