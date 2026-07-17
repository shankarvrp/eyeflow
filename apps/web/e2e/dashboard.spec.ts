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
  await expect(page.getByText("Today's revenue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add collection" })).toBeVisible();
  await expect(page.getByText("Daily target")).toBeVisible();
  await expect(page.getByText("Weekly target")).toBeVisible();
  await expect(page.getByText("Monthly target")).toBeVisible();
});

test("adds collections for multiple departments in one save", async ({ page }) => {
  const patientName = `Persistence Patient ${Date.now()}`;
  const updatedPatientName = `${patientName} Updated`;
  await signIn(page);
  await page.getByRole("button", { name: "Add collection" }).click();

  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("spinbutton", { name: "OPD cash" }).fill("500");
  await page.getByRole("spinbutton", { name: "Investigation online" }).fill("2500");
  await page.getByLabel("Investigation online mode").selectOption("UPI");
  await page.getByRole("spinbutton", { name: "Investigation discount" }).fill("500");
  await page.getByRole("button", { name: "Add 2 payments" }).click();

  await expect(page.getByText(patientName, { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByText(patientName, { exact: true })).toHaveCount(2);

  await page.getByRole("tab", { name: "Patient-wise" }).click();
  const patientRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(patientRow.getByText("2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Open patient ${patientName}` }).click();
  await page.getByLabel("Patient name").fill(updatedPatientName);
  await page
    .getByRole("spinbutton", { name: /^Patient amount/ })
    .first()
    .fill("3000");
  await page.getByLabel("Reason for changes").fill("Corrected patient payment details");
  await page.getByRole("button", { name: "Save patient changes" }).click();
  await expect(page.getByText(updatedPatientName, { exact: true })).toBeVisible();
});

test("normal users see only daily targets and can edit today's collections", async ({ page }) => {
  const patientName = `User Collection ${Date.now()}`;
  await signIn(page, {
    email: "user@eyeflow.local",
    password: "EyeFlowUser123!",
  });

  await expect(page.getByText("Daily target")).toBeVisible();
  await expect(page.getByText("Weekly target")).toHaveCount(0);
  await expect(page.getByText("Monthly target")).toHaveCount(0);

  await page.getByRole("button", { name: "Add collection" }).click();
  await page.getByLabel("Patient name").fill(patientName);
  await page.getByRole("spinbutton", { name: "Pharmacy cash" }).fill("900");
  await page.getByRole("button", { name: "Add 1 payment" }).click();
  await page.getByRole("button", { name: `Edit ${patientName} Pharmacy Cash` }).click();
  await page.getByRole("spinbutton", { name: "Gross amount" }).fill("1000");
  await page.getByRole("button", { name: "Save changes" }).click();
  const collectionRow = page.getByRole("row").filter({ hasText: patientName });
  await expect(collectionRow.getByText("₹1,000")).toBeVisible();
});
