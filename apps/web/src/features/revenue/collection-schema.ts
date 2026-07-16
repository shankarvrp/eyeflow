import { type DepartmentName, departments, type PaymentKind, paymentKinds } from "@eyeflow/shared";
import { z } from "zod";

export const creditProviders = ["CGHS", "ECHS", "Star Health", "Medi Assist", "Other"] as const;
export const onlineModes = ["UPI", "Card", "NEFT", "RTGS", "Other"] as const;

const moneyString = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Enter a valid amount");

export const collectionSchema = z
  .object({
    amount: moneyString.refine((value) => Number(value) > 0, "Amount must be greater than zero"),
    department: z.enum(departments),
    discount: moneyString,
    mode: z.enum(paymentKinds),
    patient: z.string().trim().min(2, "Enter at least two characters").max(120),
    providerOrMode: z.string(),
  })
  .refine((value) => Number(value.discount) <= Number(value.amount), {
    message: "Discount cannot exceed the amount",
    path: ["discount"],
  })
  .refine((value) => value.mode === "cash" || value.providerOrMode.length > 0, {
    message: "Choose a provider or payment mode",
    path: ["providerOrMode"],
  });

export type CollectionFormValues = z.input<typeof collectionSchema>;

export interface NewCollection {
  amount: number;
  department: DepartmentName;
  discount: number;
  mode: PaymentKind;
  patient: string;
  providerOrMode: string | null;
}

export const newCollectionServerSchema = z
  .object({
    amount: z.number().positive().max(10_000_000),
    department: z.enum(departments),
    discount: z.number().min(0).max(10_000_000),
    mode: z.enum(paymentKinds),
    patient: z.string().trim().min(2).max(120),
    providerOrMode: z.string().trim().max(120).nullable(),
  })
  .refine((value) => value.discount <= value.amount, {
    message: "Discount cannot exceed the amount",
    path: ["discount"],
  })
  .refine((value) => value.mode === "cash" || Boolean(value.providerOrMode), {
    message: "A provider or payment mode is required",
    path: ["providerOrMode"],
  });

export function toNewCollection(value: z.infer<typeof collectionSchema>): NewCollection {
  return {
    amount: Number(value.amount),
    department: value.department,
    discount: Number(value.discount),
    mode: value.mode,
    patient: value.patient.trim(),
    providerOrMode: value.mode === "cash" ? null : value.providerOrMode,
  };
}

export const paymentModeLabels = {
  cash: "Cash",
  credit: "Credit",
  online: "Online",
} as const satisfies Record<PaymentKind, string>;
