import { expect, test } from "@playwright/test";

// Exercises the core human-in-the-loop flow against seeded mock data
// (AUTH_DEV_BYPASS is on for local/dev, so no real Google login is
// needed): load the dashboard, open a Needs Attention task, edit a
// field, mark it complete, and confirm it moves to — and stays in —
// Completed.
test("open a task, edit it, mark complete, and see it move to Completed", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "HackHERS Task Inbox" })).toBeVisible();

  const taskTitle = "Confirm workshop time with Acme Corp";
  await page.getByRole("button", { name: new RegExp(taskTitle) }).click();

  await expect(page.getByLabel("Task title")).toHaveValue(taskTitle);

  // Edit the priority field and save.
  await page.getByLabel("Priority").selectOption("LOW");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  // Mark the task complete.
  await page.getByRole("button", { name: "Mark complete" }).click();

  // It should disappear from Needs Attention...
  await expect(page.getByRole("button", { name: new RegExp(taskTitle) })).toHaveCount(0);

  // ...and appear in Completed.
  await page.getByRole("button", { name: /^Completed/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(taskTitle) })).toBeVisible();
});
