import { expect, test } from "@playwright/test";

async function signIn(
  page: import("@playwright/test").Page,
  credentials = {
    email: "admin@eyeflow.local",
    password: "EyeFlowAdmin123!",
  },
) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  const signInButton = page.getByRole("button", { name: "Sign in securely" });
  await expect(signInButton).toBeEnabled();
  const emailInput = page.getByLabel("Email address");
  const passwordInput = page.getByLabel("Password", { exact: true });
  await emailInput.clear();
  await emailInput.pressSequentially(credentials.email);
  await passwordInput.clear();
  await passwordInput.pressSequentially(credentials.password);
  await expect(emailInput).toHaveValue(credentials.email);
  await expect(passwordInput).toHaveValue(credentials.password);
  const authResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/sign-in/email"),
  );
  await signInButton.click();
  await authResponse;
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", {
      name:
        credentials.email === "admin@eyeflow.local"
          ? "DS Dr. Shankar admin"
          : "CU Collection User user",
    }),
  ).toBeVisible();
}

test("renders the EyeFlow dashboard shell", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Good morning, Dr. Shankar" })).toBeVisible();
  await expect(page.getByText("Collection revenue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync EMR" })).toBeVisible();
  await expect(page.getByText("Daily target")).toBeVisible();
  await expect(page.getByText("Weekly target")).toBeVisible();
  await expect(page.getByText("Monthly target")).toBeVisible();
  await page.getByRole("button", { name: "Enable live" }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toBeVisible();

  const excelDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Excel" }).click();
  await expect((await excelDownload).suggestedFilename()).toMatch(/\.xlsx$/);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF" }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
});

test("administrators can open role and department access management", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Administration" }).click();
  await expect(page).toHaveURL("/administration");
  await expect(page.getByRole("heading", { name: "Access control" })).toBeVisible();
  await expect(page.getByText("admin@eyeflow.local", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Collection User user@eyeflow\.local/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Role")).toBeVisible();
});

test("adds collections for multiple departments in one save", async ({ page }) => {
  const patientName = `E2E Test Admin Patient ${Date.now()}`;
  const updatedPatientName = `${patientName} Updated`;
  await signIn(page);
  await page.getByRole("button", { name: "Add collection" }).click();

  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("spinbutton", { name: "OPD payment 1 amount" }).fill("500");
  await page.getByRole("button", { name: "Add OPD payment" }).click();
  await page.getByRole("spinbutton", { name: "OPD payment 2 amount" }).fill("700");
  await page.getByRole("button", { name: "Add Investigation department" }).click();
  await page.getByLabel("Investigation payment 1 mode").selectOption("online");
  await page.getByRole("spinbutton", { name: "Investigation payment 1 amount" }).fill("2500");
  await page.getByLabel("Investigation payment 1 provider or mode").selectOption("UPI");
  await page.getByRole("spinbutton", { name: "Investigation payment 1 discount" }).fill("500");
  await page.getByRole("button", { name: "Save 3 payments" }).click();

  await expect(page.getByText(patientName, { exact: true })).toHaveCount(3);
  await page.reload();
  await expect(page.getByText(patientName, { exact: true })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Add collection" })).toBeEnabled();

  await page.getByRole("tab", { name: "Patient-wise" }).click();
  await expect(page.getByRole("tab", { name: "Patient-wise" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const patientRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(patientRow.getByText("3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Open patient ${patientName}` }).click();
  await page.getByLabel("Patient name").fill(updatedPatientName);
  await page
    .getByRole("spinbutton", { name: /^Patient amount/ })
    .first()
    .fill("3000");
  await page.getByRole("button", { name: "Add Opticals department to patient" }).click();
  await page.getByRole("spinbutton", { name: `${patientName} new amount new-1` }).fill("800");
  await page.getByLabel("Reason for changes").fill("Corrected patient payment details");
  await page.getByRole("button", { name: "Save patient changes" }).click();
  await expect(page.getByText(updatedPatientName, { exact: true })).toBeVisible();
  const updatedPatientRow = page.getByRole("row").filter({ hasText: updatedPatientName });
  await expect(updatedPatientRow.getByText("4", { exact: true })).toBeVisible();
  await expect(updatedPatientRow.getByText("Opticals", { exact: true })).toBeVisible();
});

test("normal users see only daily targets and can edit today's collections", async ({ page }) => {
  const patientName = `E2E Test User Patient ${Date.now()}`;
  await signIn(page, {
    email: "user@eyeflow.local",
    password: "EyeFlowUser123!",
  });

  await expect(page.getByText("Daily target")).toBeVisible();
  await expect(page.getByText("Weekly target")).toHaveCount(0);
  await expect(page.getByText("Monthly target")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enable live" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add collection" }).click();
  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("spinbutton", { name: "Pharmacy payment 1 amount" }).fill("900");
  await page.getByRole("button", { name: "Save 1 payment" }).click();
  await page.getByRole("button", { name: `Edit ${patientName} Pharmacy Cash` }).click();
  await page.getByRole("spinbutton", { name: "Gross amount" }).fill("1000");
  await page.getByRole("button", { name: "Save changes" }).click();
  const collectionRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(collectionRow.getByText("₹1,000")).toBeVisible();

  const today = await page.getByLabel("From").inputValue();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.getByLabel("From")).not.toHaveValue(today);
});
