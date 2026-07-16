import { expect, test } from "@playwright/test";

test("renders the EyeFlow dashboard shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Dr. Shankar" })).toBeVisible();
  await expect(page.getByText("Today's revenue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add collection" })).toBeVisible();
});

test("adds a collection and updates dashboard totals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add collection" }).click();

  await page.getByLabel("Patient name").fill("E2E Patient");
  await page.getByRole("button", { name: "Opticals" }).click();
  await page.getByLabel("Amount").fill("2500");
  await page.getByLabel("Discount").fill("500");
  await expect(page.getByText("₹2,000")).toBeVisible();
  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(page.getByRole("row", { name: "EP E2E Patient Opticals Cash" })).toBeVisible();
  await expect(page.getByText("₹1,69,910")).toBeVisible();
});
