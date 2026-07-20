import { exit, stdout } from "node:process";
import { createDatabase } from "@eyeflow/db";
import { user } from "@eyeflow/db/schema";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { importEmrAppointments, importEmrReceipts } from "../src/features/emr/emr.server";
import { scrapeEmrAppointments, scrapeEmrReceipts } from "../src/features/emr/emr-browser.server";
import { clinicDateKey } from "./emr-config";

config({ path: "../../.env", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for EMR synchronization.");

const requestedDate = process.argv[2] ?? clinicDateKey();
if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
  throw new Error("Pass an optional synchronization date in YYYY-MM-DD format.");
}

const db = createDatabase(databaseUrl);
const [administrator] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.role, "admin"))
  .limit(1);
if (!administrator) throw new Error("Seed an EyeFlow administrator before synchronizing the EMR.");

const receipts = await scrapeEmrReceipts(requestedDate);
await importEmrReceipts(receipts, administrator.id, requestedDate);
const appointments = await scrapeEmrAppointments(requestedDate);
await importEmrAppointments(appointments, administrator.id, requestedDate);

stdout.write(
  `Synchronized ${appointments.length} patient appointment${appointments.length === 1 ? "" : "s"} and ${receipts.length} collection receipt${receipts.length === 1 ? "" : "s"} for ${requestedDate}.\n`,
);
exit(0);
