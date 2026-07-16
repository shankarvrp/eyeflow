import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://eyeflow:eyeflow_dev_password@localhost:5432/eyeflow",
  },
  strict: true,
  verbose: true,
});
