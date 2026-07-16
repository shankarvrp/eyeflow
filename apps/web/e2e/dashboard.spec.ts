import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByLabel("Email address").fill("admin@eyeflow.local");
  await page.getByLabel("Password", { exact: true }).fill("EyeFlowAdmin123!");
  const authResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/sign-in/email"),
  );
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await authResponse;
  await expect(page).toHaveURL("/");
}

test("renders the EyeFlow dashboard shell", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Good morning, Dr. Shankar" })).toBeVisible();
  await expect(page.getByText("Today's revenue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add collection" })).toBeVisible();
});

test("adds a collection and updates dashboard totals", async ({ page }) => {
  const patientName = `Persistence Patient ${Date.now()}`;
  await signIn(page);
  await page.getByRole("button", { name: "Add collection" }).click();

  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("button", { name: "Opticals" }).click();
  await page.getByLabel("Amount").fill("2500");
  await page.getByLabel("Discount").fill("500");
  await expect(page.getByText("₹2,000")).toBeVisible();
  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(page.getByText(patientName, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(patientName, { exact: true })).toBeVisible();
});
