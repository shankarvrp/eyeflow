import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const permissionStatements = {
  ...defaultStatements,
  dashboard: ["read", "live", "export"],
  revenue: ["read", "create", "edit-current", "edit-history"],
} as const;

export const accessControl = createAccessControl(permissionStatements);

export const adminRole = accessControl.newRole({
  ...adminAc.statements,
  dashboard: ["read", "live", "export"],
  revenue: ["read", "create", "edit-current", "edit-history"],
});

export const userRole = accessControl.newRole({
  dashboard: ["read"],
  revenue: ["read", "create", "edit-current"],
});

export const roleDefinitions = {
  admin: adminRole,
  user: userRole,
} as const;

export type EyeFlowRole = keyof typeof roleDefinitions;
