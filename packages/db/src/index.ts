import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type EyeFlowDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

export * from "./schema";
