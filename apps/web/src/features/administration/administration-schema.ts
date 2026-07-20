import { departments } from "@eyeflow/shared";
import { z } from "zod";

const departmentAccessSchema = z.object({
  canCreate: z.boolean(),
  canEditCurrent: z.boolean(),
  canView: z.boolean(),
  department: z.enum(departments),
});

export const updateUserAccessSchema = z.object({
  access: z.array(departmentAccessSchema).length(departments.length),
  reason: z.string().trim().min(3).max(240),
  role: z.enum(["admin", "user"]),
  userId: z.string().min(1),
});

export type UpdateUserAccess = z.infer<typeof updateUserAccessSchema>;

const targetAmountSchema = z.number().positive().max(100_000_000);

export const updateRevenueTargetsSchema = z
  .object({
    daily: targetAmountSchema,
    monthly: targetAmountSchema,
    reason: z.string().trim().min(3).max(240),
    weekly: targetAmountSchema,
  })
  .refine((value) => value.weekly >= value.daily, {
    message: "Weekly target must be at least the daily target",
    path: ["weekly"],
  })
  .refine((value) => value.monthly >= value.weekly, {
    message: "Monthly target must be at least the weekly target",
    path: ["monthly"],
  });

export type UpdateRevenueTargets = z.infer<typeof updateRevenueTargetsSchema>;
