import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDatabase, user } from "@eyeflow/db";
import * as schema from "@eyeflow/db/schema";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://eyeflow:eyeflow_dev_password@localhost:5432/eyeflow";
const email = process.env.EYEFLOW_ADMIN_EMAIL ?? "admin@eyeflow.local";
const password = process.env.EYEFLOW_ADMIN_PASSWORD ?? "EyeFlowAdmin123!";
const name = process.env.EYEFLOW_ADMIN_NAME ?? "Dr. Shankar";
const db = createDatabase(databaseUrl);

const seedAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 10,
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "eyeflow-development-secret-change-before-production",
  telemetry: {
    enabled: false,
  },
});

const [existingUser] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, email))
  .limit(1);

if (!existingUser) {
  const result = await seedAuth.api.signUpEmail({
    body: {
      email,
      name,
      password,
    },
  });

  if (!result.user.id) throw new Error("Better Auth did not return a seeded user.");
}

await db.update(user).set({ role: "admin", updatedAt: new Date() }).where(eq(user.email, email));

console.log(`EyeFlow administrator ready: ${email}`);
await db.$client.end();
