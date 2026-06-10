import { test, expect } from "@playwright/test";

/**
 * Real-stack core value loop — nothing mocked (FE-7 / M2.6).
 *
 * Starts authenticated (storageState from auth.setup.ts) then:
 *   create project → create log source → reveal key → ingest a log via the
 *   real API → see that log on the /logs page (a genuine ingest → RabbitMQ →
 *   ES → UI round-trip).
 *
 * Requires a running composed stack pointed at by PLAYWRIGHT_BASE_URL; the API
 * is reached directly for ingest via E2E_API_URL (browser-reachable origin).
 */

const API_URL = process.env.E2E_API_URL ?? "http://localhost:5190";

test("login → project → log source → ingest → see it on /logs", async ({
  page,
  request,
}) => {
  // Unique per run so re-runs don't collide on the per-org unique project slug
  // and so the logs assertion can't match a stale row from a previous run.
  const stamp = Date.now();
  const projectName = `E2E Project ${stamp}`;
  const logMessage = `e2e-ingest-${stamp} checkout failed for order 42`;

  // 1) Create a project via the wizard.
  await page.goto("/projects/new");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create Project" }).click();

  // Lands on the new project's detail page.
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/i, { timeout: 30_000 });
  const projectId = page.url().split("/projects/")[1];
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);

  // 2) Create a log source. Capture the one-time API key + id from the POST
  //    response (un-enveloped { logSource, apiKey }) rather than scraping the
  //    reveal modal — sturdier than DOM timing.
  const createResponse = page.waitForResponse(
    (r) =>
      /\/projects\/[^/]+\/log-sources$/.test(new URL(r.url()).pathname) &&
      r.request().method() === "POST" &&
      r.ok(),
    { timeout: 30_000 },
  );

  await page.getByRole("button", { name: /add log source/i }).click();
  await page.getByLabel("Name").fill("E2E Source");
  await page.getByLabel("application").check();
  await page.getByRole("button", { name: "Create" }).click();

  const created = (await (await createResponse).json()) as {
    logSource: { id: string };
    apiKey: string;
  };
  const apiKey = created.apiKey;
  const logSourceId = created.logSource.id;
  expect(apiKey).toBeTruthy();

  // Dismiss the one-time key reveal modal (confirm + Done) to leave clean state.
  await page
    .getByText(/I have saved this key somewhere safe/i)
    .click();
  await page.getByRole("button", { name: "Done" }).click();

  // 3) Ingest a log through the real API with the freshly minted key.
  const ingest = await request.post(`${API_URL}/api/v1/logs/ingest`, {
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    data: {
      projectId,
      logSourceId,
      entries: [
        {
          level: "Error",
          message: logMessage,
          timestamp: new Date().toISOString(),
          serviceName: "e2e-suite",
        },
      ],
    },
  });
  expect(ingest.status(), await ingest.text()).toBe(202);

  // 4) See it on /logs — filter to the project, then assert the message row
  //    renders. The auto-retrying assertion absorbs ES eventual consistency
  //    (ingest is async: API → RabbitMQ → consumer → ES index).
  await page.goto("/logs");
  await page.getByLabel("Filter by project").selectOption({ label: projectName });
  await expect(page.getByText(logMessage)).toBeVisible({ timeout: 60_000 });
});
