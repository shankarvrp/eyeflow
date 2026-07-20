import { z } from "zod";
import { isoDateSchema } from "../revenue/collection-query";

export const closeDaySchema = z.object({
  businessDate: isoDateSchema,
  reason: z.string().trim().min(3).max(240),
});

export const reopenDaySchema = closeDaySchema;
