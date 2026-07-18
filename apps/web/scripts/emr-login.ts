import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { chromium } from "@playwright/test";
import {
  appointmentsUrl,
  clinicDateKey,
  emrProfileDirectory,
  ensurePrivateProfileDirectory,
} from "./emr-config";

await ensurePrivateProfileDirectory();
const context = await chromium.launchPersistentContext(emrProfileDirectory, {
  headless: false,
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(appointmentsUrl(clinicDateKey()), { waitUntil: "domcontentloaded" });

const prompt = createInterface({ input: stdin, output: stdout });
try {
  await prompt.question(
    "Sign in to the EMR in the opened browser. When the appointments page is visible, press Enter here to save the local session. ",
  );
} finally {
  prompt.close();
  await context.close();
}

stdout.write("EMR session saved locally. No password was stored by EyeFlow.\n");
