import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDatabase, departments, user, userDepartmentAccess } from "@eyeflow/db";
import * as schema from "@eyeflow/db/schema";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://eyeflow:eyeflow_dev_password@localhost:5432/eyeflow";
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

interface SeedUser {
  email: string;
  name: string;
  password: string;
  role: "admin" | "user";
}

async function ensureUser(seed: SeedUser): Promise<string> {
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, seed.email))
    .limit(1);

  let userId = existingUser?.id;
  if (!userId) {
    const result = await seedAuth.api.signUpEmail({
      body: {
        email: seed.email,
        name: seed.name,
        password: seed.password,
      },
    });
    userId = result.user.id;
  }

  if (!userId) throw new Error(`Better Auth did not return a user for ${seed.email}.`);
  await db.update(user).set({ role: seed.role, updatedAt: new Date() }).where(eq(user.id, userId));
  return userId;
}

const adminEmail = process.env.EYEFLOW_ADMIN_EMAIL ?? "admin@eyeflow.local";
await ensureUser({
  email: adminEmail,
  name: process.env.EYEFLOW_ADMIN_NAME ?? "Dr. Shankar",
  password: process.env.EYEFLOW_ADMIN_PASSWORD ?? "EyeFlowAdmin123!",
  role: "admin",
});

const collectionUserEmail = process.env.EYEFLOW_USER_EMAIL ?? "user@eyeflow.local";
const collectionUserId = await ensureUser({
  email: collectionUserEmail,
  name: process.env.EYEFLOW_USER_NAME ?? "Collection User",
  password: process.env.EYEFLOW_USER_PASSWORD ?? "EyeFlowUser123!",
  role: "user",
});

const departmentRows = await db.select({ id: departments.id }).from(departments);
if (departmentRows.length > 0) {
  await db
    .insert(userDepartmentAccess)
    .values(
      departmentRows.map((department) => ({
        canCreate: true,
        canEditCurrent: true,
        canEditHistory: false,
        canView: true,
        departmentId: department.id,
        userId: collectionUserId,
      })),
    )
    .onConflictDoUpdate({
      set: {
        canCreate: true,
        canEditCurrent: true,
        canEditHistory: false,
        canView: true,
        updatedAt: new Date(),
      },
      target: [userDepartmentAccess.userId, userDepartmentAccess.departmentId],
    });
}

console.log(`EyeFlow administrator ready: ${adminEmail}`);
console.log(`EyeFlow collection user ready: ${collectionUserEmail}`);
await db.$client.end();
