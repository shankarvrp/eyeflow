import { z } from "zod";
import { isoDateSchema } from "../revenue/collection-query";

export const closeDaySchema = z.object({
  businessDate: isoDateSchema,
  reason: z.string().trim().min(3).max(240),
});

export const reopenDaySchema = closeDaySchema;

const declaredAmountSchema = z.number().min(0).max(100_000_000);

export const signOffCollectionSchema = z.object({
  businessDate: isoDateSchema,
  declaredCash: declaredAmountSchema,
  declaredCredit: declaredAmountSchema,
  declaredDiscount: declaredAmountSchema,
  declaredOnline: declaredAmountSchema,
  note: z.string().trim().min(3).max(240),
  period: z.enum(["midday", "endofday"]),
});

export type SignOffCollection = z.infer<typeof signOffCollectionSchema>;
