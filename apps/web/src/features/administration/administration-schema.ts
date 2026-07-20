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
