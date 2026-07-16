import { betterAuth } from "better-auth";

export {
  accessControl,
  adminRole,
  cashierRole,
  roleDefinitions,
  viewerRole,
} from "./permissions";

export type EyeFlowAuthOptions = Parameters<typeof betterAuth>[0];

/**
 * Creates the authentication service. Database adapters, providers, and RBAC
 * plugins are composed by the web app when persistence is enabled.
 */
export function createEyeFlowAuth(options: EyeFlowAuthOptions) {
  return betterAuth(options);
}
