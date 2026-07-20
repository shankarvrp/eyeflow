import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type EyeFlowDatabase = ReturnType<typeof createDatabase>;

function connectDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    idle_timeout: 5,
    max: 1,
    max_lifetime: 60,
    prepare: false,
  });
  return drizzle(client, { schema });
}

type DatabaseConnection = ReturnType<typeof connectDatabase>;
const databaseRegistry = globalThis as typeof globalThis & {
  __eyeFlowDatabases?: Map<string, DatabaseConnection>;
};

export function createDatabase(databaseUrl: string) {
  databaseRegistry.__eyeFlowDatabases ??= new Map();
  const existing = databaseRegistry.__eyeFlowDatabases.get(databaseUrl);
  if (existing) return existing;
  const database = connectDatabase(databaseUrl);
  databaseRegistry.__eyeFlowDatabases.set(databaseUrl, database);
  return database;
}

export * from "./schema";
