import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { accessControl, adminRole, cashierRole, viewerRole } from "@eyeflow/auth";
import { createDatabase } from "@eyeflow/db";
import * as schema from "@eyeflow/db/schema";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize EyeFlow authentication.");
}

export const authDatabase = createDatabase(databaseUrl);

export const auth = betterAuth({
  appName: "EyeFlow",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(authDatabase, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    disableSignUp: true,
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 10,
  },
  plugins: [
    admin({
      ac: accessControl,
      defaultRole: "viewer",
      roles: {
        admin: adminRole,
        cashier: cashierRole,
        viewer: viewerRole,
      },
    }),
    tanstackStartCookies(),
  ],
  rateLimit: {
    enabled: true,
    max: 100,
    window: 60,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  telemetry: {
    enabled: false,
  },
  trustedOrigins: [
    process.env.APP_URL ?? "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ],
});

export type EyeFlowSession = typeof auth.$Infer.Session;
