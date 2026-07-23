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
  await expect(page.getByRole("heading", { name: /July 2026/ })).toBeVisible();
  await expect(page.getByText("Good morning, Dr. Shankar")).toHaveCount(0);
  await expect(page.getByText("Today's collection pulse")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync EMR" })).toBeVisible();
  const autoSyncControl = page.getByLabel("Enable automatic EMR sync");
  if ((await autoSyncControl.count()) === 1) {
    await expect(autoSyncControl).not.toBeChecked();
  } else {
    await expect(page.getByRole("button", { name: "Connect EMR" })).toBeVisible();
  }
  await expect(page.getByText("Collection period")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Patient mix" })).toBeVisible();
  await expect(page.getByText("Action required: collection handover")).toBeVisible();
  const departmentAmounts = await page
    .getByTestId("department-performance-row")
    .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute("data-department-amount"))));
  expect(departmentAmounts).toEqual([...departmentAmounts].sort((left, right) => right - left));
  for (const testId of ["patient-count", "payment-count", "department-count"]) {
    const fontSize = await page
      .getByTestId(testId)
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(24);
  }
  await page.setViewportSize({ height: 900, width: 760 });
  await expect(page.getByRole("textbox", { exact: true, name: "From" })).toBeVisible();
  await expect(page.getByRole("textbox", { exact: true, name: "To" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply range" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByText("Pending", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Daily target")).toHaveCount(0);
  const middayBadge = page.getByRole("button", {
    name: /Open Mid-day reconciliation:/,
  });
  const endOfDayBadge = page.getByRole("button", {
    name: /Open End-of-day reconciliation:/,
  });
  await expect(middayBadge).toBeVisible();
  await expect(endOfDayBadge).toBeVisible();
  await middayBadge.click();
  await expect(page.getByRole("heading", { name: "Mid-day collection handover" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collection reconciliation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Add patient collections" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Enable live" }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toBeVisible();
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
  await expect(page.getByLabel("Daily target", { exact: true })).toHaveValue("200000");
  await expect(page.getByRole("button", { name: "Save targets" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Department targets" })).toBeVisible();
  await expect(page.getByLabel("OPD weekly target")).toBeVisible();
});

test("revenue, patients, and reports modules are operational", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Revenue" }).click();
  await expect(page).toHaveURL("/revenue");
  await expect(page.getByRole("heading", { name: "Revenue workspace" })).toBeVisible();
  await page.getByRole("link", { name: "Patients" }).click();
  await expect(page).toHaveURL("/patients");
  await expect(page.getByRole("heading", { name: "All patients" })).toBeVisible();
  await expect(page.getByText("Patient-wise expanded view")).toBeVisible();
  const patientTo = await page.getByRole("textbox", { exact: true, name: "To" }).inputValue();
  await expect(page.getByRole("textbox", { exact: true, name: "From" })).toHaveValue(patientTo);
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Department and date-wise collection")).toBeVisible();
  await expect(page.getByText("Patient time spent")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clinic target pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Department target meters" })).toBeVisible();
  await page.getByText("This month", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "This month" })).toBeChecked();

  const excelDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Excel" }).click();
  await expect((await excelDownload).suggestedFilename()).toMatch(/\.xlsx$/);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF" }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
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
  await page.getByRole("button", { name: `Edit ${patientName} Investigation Online` }).click();
  await expect(page.getByRole("heading", { name: "Patient collection workspace" })).toBeVisible();
  await page.keyboard.press("Escape");
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

test("normal users see department targets in reports and can edit today's collections", async ({
  page,
}) => {
  const patientName = `E2E Test User Patient ${Date.now()}`;
  await signIn(page, {
    email: "user@eyeflow.local",
    password: "EyeFlowUser123!",
  });

  await expect(page.getByText("Daily target")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enable live" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Mid-day reconciliation:/ })).toBeVisible();

  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Department target meters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clinic target pulse" })).toHaveCount(0);
  await page.getByRole("link", { name: "Overview" }).click();

  await page.getByRole("button", { name: "Add collection" }).click();
  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("spinbutton", { name: "Pharmacy payment 1 amount" }).fill("900");
  await page.getByRole("button", { name: "Save 1 payment" }).click();
  await page.getByRole("button", { name: `Edit ${patientName} Pharmacy Cash` }).click();
  await page.getByRole("spinbutton", { name: /^Patient amount/ }).fill("1000");
  await page.getByLabel("Reason for changes").fill("Corrected same-day collection");
  await page.getByRole("button", { name: "Save patient changes" }).click();
  const collectionRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(collectionRow.getByText("₹1,000")).toBeVisible();

  const today = await page.getByLabel("From").inputValue();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.getByLabel("From")).not.toHaveValue(today);
});
