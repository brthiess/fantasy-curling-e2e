import { expect, test, type Page } from "@playwright/test";

import { tournamentInsightsFixture as fixture } from "../../../fantasy-curling-frontend/src/test/insights-fixture";

async function setup(page: Page, signedIn = false, tournaments = fixture()) {
  await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/current-user", route => route.fulfill({ json: { success: true, signedIn, user: {
    id: signedIn ? "user1" : "", username: signedIn ? "iceking" : "", teamName: "Ice Kings", accountInitial: "I", totalPoints: 17,
    backgroundColor: "blue", globalRank: 1, profilePicture: null, isProfilePictureEnabled: false, joinDate: "2023-01-01", tournaments, leaderboards: [],
  } } }));
  return errors;
}
for (const signedIn of [false, true]) for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`${signedIn ? "signed-in" : "anonymous"} insights at ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, signedIn);
    await page.setViewportSize({ width, height: 900 }); await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Tournament insights", exact: true })).toBeVisible();
    await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("active");
    await expect(page).toHaveURL(/tournamentId=active/);
    await expect(page.getByText("Percentage of 10 eligible entries", { exact: false })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(width >= 1024 ? 1 : 0);
    await expect(page.getByRole("heading", { name: "Fantasy points vs. ownership", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tournament charts" }).getByRole("button")).toHaveCount(3);
    await expect(page.getByRole("article", { name: "Your Picks contribution chart" })).toHaveCount(signedIn ? 1 : 0);
    if (signedIn) await expect(page.getByRole("heading", { name: "Your Tournament total: 17 pts" })).toBeVisible();
    else await expect(page.getByRole("link", { name: "Sign in", exact: true }).last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`stats-${signedIn ? "signed-in" : "anonymous"}-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test("combined filters, sorting, contributions, selector and history", async ({ page }) => {
  await setup(page, true); await page.setViewportSize({ width: 390, height: 900 }); await page.goto("/stats?extra=kept");
  await expect(page.getByText("Showing 4 of 4 Teams")).toBeVisible();
  await page.getByLabel("My Picks only").check(); await expect(page.getByText("Showing 2 of 4 Teams")).toBeVisible();
  await page.getByLabel("Search Teams").fill("  brown  "); await expect(page.getByText("Showing 1 of 4 Teams")).toBeVisible();
  await expect(page.getByText("Your contribution: 8.5 pts", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Tournament total: 17 pts" })).toBeVisible();
  await page.getByLabel("Pool", { exact: true }).selectOption("B"); await expect(page.getByText("No Teams match your filters.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Sort by").selectOption("pickCount"); await page.getByRole("button", { name: "Descending" }).click();
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await expect(page.getByText("Ownership", { exact: false }).filter({ hasText: "Provisional" }).last()).toBeVisible();
  await expect(page).toHaveURL(/extra=kept/);
  await page.reload(); await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("upcoming");
  await page.goBack(); await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("active");
  await expect(page.getByLabel("Search Teams")).toHaveValue("");
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("button", { name: "Wins", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: /Wins/ })).toHaveAttribute("aria-sort", "descending");
  await page.getByRole("button", { name: /Wins/ }).click();
  await expect(page.getByRole("columnheader", { name: /Wins/ })).toHaveAttribute("aria-sort", "ascending");
});
for (const width of [320, 1440]) test(`loading, retry, refresh failure and empty states at ${width}px`, async ({ page }, info) => {
  await setup(page); await page.setViewportSize({ width, height: 900 });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/current-user", async route => { await gate; await route.fulfill({ status: 503, json: {} }); });
  await page.goto("/stats"); await expect(page.getByText("Loading Tournament insights", { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`loading-${width}.png`), fullPage: true }); release();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await page.screenshot({ path: info.outputPath(`error-${width}.png`), fullPage: true });
  await page.unroute("**/api/current-user"); await setup(page); await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Showing 4 of 4 Teams")).toBeVisible();
  await page.route("**/api/current-user", route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("showing the previous snapshot");
  await expect(page.getByText("Showing 4 of 4 Teams")).toBeVisible();
  await page.unroute("**/api/current-user"); const ts = fixture(); ts[0].insights!.eligibleEntryCount = 0;
  ts[0].insights!.teams.forEach(t => { t.pickCount = 0; t.ownershipPercentage = null; });
  await setup(page, false, ts); await page.reload();
  await expect(page.getByText("No eligible entries yet.", { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`zero-entries-${width}.png`), fullPage: true });
  await page.getByLabel("Search Teams").fill("no match");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: info.outputPath(`no-match-${width}.png`), fullPage: true });
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: info.outputPath(`upcoming-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("keyboard sorting and expanded ties are accessible", async ({ page }) => {
  await setup(page, true); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/stats");
  const wins = page.getByRole("button", { name: "Wins", exact: true });
  await wins.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("columnheader", { name: /Wins/ })).toHaveAttribute("aria-sort", "descending");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("columnheader", { name: /Wins/ })).toHaveAttribute("aria-sort", "ascending");
  const ties = page.getByText("+2 tied Teams", { exact: true }); await ties.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Tournament insight cards" }).getByText("Davies", { exact: false }).first()).toBeVisible();
});

test("chart markers support hover, keyboard and touch without following table filters", async ({ page, browser }) => {
  await setup(page, true); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/stats");
  const chart = page.getByRole("article", { name: "Tournament overview chart" });
  const tied = chart.getByRole("button", { name: /Campbell.*Davies/ });
  await tied.hover(); await expect(chart.getByRole("status")).toContainText("Campbell");
  await expect(chart.getByRole("status")).toContainText("Davies");
  const personal = chart.getByRole("button", { name: /Brown.*Your Pick/ });
  await personal.focus(); await page.keyboard.press("Enter");
  await expect(personal).toHaveAttribute("aria-pressed", "true");
  await expect(chart.getByRole("status")).toContainText("Your Pick");
  await page.getByLabel("Search Teams").fill("no match");
  await page.getByLabel("My Picks only").check();
  await expect(chart.getByRole("button")).toHaveCount(3);
  await expect(page.getByRole("article", { name: "Your Picks contribution chart" })).toContainText("17 pts");
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await expect(chart.getByRole("heading", { name: "Team ownership", exact: true })).toBeVisible();
  await expect(chart.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Contributions appear when scoring starts.", { exact: true })).toBeVisible();
  const context = await browser.newContext({ viewport: { width: 320, height: 900 }, hasTouch: true });
  const touchPage = await context.newPage(); await setup(touchPage, true); await touchPage.goto("/stats");
  const touchChart = touchPage.getByRole("article", { name: "Tournament overview chart" });
  await touchChart.getByRole("button", { name: /Brown.*Your Pick/ }).tap();
  await expect(touchChart.getByRole("status")).toContainText("Brown");
  await touchChart.getByRole("button", { name: /Campbell.*Davies/ }).tap();
  await expect(touchChart.getByRole("status")).toContainText("Davies"); await context.close();
});

for (const width of [320, 1440]) test(`chart states and marker details at ${width}px`, async ({ page }, info) => {
  const errors = await setup(page, true); await page.setViewportSize({ width, height: 900 }); await page.goto("/stats");
  const chart = page.getByRole("article", { name: "Tournament overview chart" });
  await chart.getByRole("button", { name: /Campbell.*Davies/ }).click();
  await expect(chart.getByRole("status")).toContainText("Unpicked");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: info.outputPath(`chart-overlap-${width}.png`), fullPage: true });
  await page.getByLabel("Tournament", { exact: true }).selectOption("completed");
  await expect(page.getByRole("heading", { name: "Fantasy points vs. ownership", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: info.outputPath(`chart-completed-${width}.png`), fullPage: true });
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: info.outputPath(`chart-upcoming-${width}.png`), fullPage: true });
  const ts = fixture(); ts[0].insights!.teams.forEach(row => { row.fantasyPoints = null; row.ownershipPercentage = null; });
  await setup(page, true, ts); await page.goto("/stats?tournamentId=active");
  await expect(chart).toContainText("No Teams have both scoring and ownership");
  await expect(page.getByRole("article", { name: "Your Picks contribution chart" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`chart-unavailable-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
