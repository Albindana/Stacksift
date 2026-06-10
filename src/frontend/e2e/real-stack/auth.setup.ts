import { test as setup, expect } from "@playwright/test";

/**
 * Real-stack auth setup — logs in once through the actual Keycloak ROPC flow
 * (the in-app /login form) and saves the BFF session as storageState so the
 * journey spec starts authenticated. Runs as the `real-setup` project; the
 * `real-stack` project depends on it.
 *
 * Credentials default to the seeded dev `e2e-user`
 * (infrastructure/keycloak/stacksift-realm.json) and can be overridden via
 * E2E_USER / E2E_PASSWORD.
 */

const STORAGE_STATE = "e2e/.auth/user.json";

setup("authenticate via real Keycloak", async ({ page }) => {
  const email = process.env.E2E_USER ?? "e2e@stacksift.local";
  const password = process.env.E2E_PASSWORD ?? "E2eRunner!23";

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The seeded e2e-user is an owner with an org, so it lands on the dashboard.
  // Asserting the heading (not just the URL) confirms the session cookie is set
  // and OrgGuard let us through — i.e. a real authenticated render.
  await expect(
    page.getByRole("heading", { name: /overview/i }),
  ).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
