import { expect, test, type Page } from "@playwright/test";

import { tournamentInsightsFixture as fixture } from "../../../fantasy-curling-frontend/src/test/insights-fixture";

async function setup(page: Page, signedIn = false, tournaments = fixture()) {
  await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/api/current-user", route => route.fulfill({ json: { success: true, signedIn, user: {
    id: signedIn ? "user1" : "", username: signedIn ? "iceking" : "", teamName: "Ice Kings", accountInitial: "I", totalPoints: 17,
    backgroundColor: "blue", globalRank: 1, profilePicture: null, isProfilePictureEnabled: false, joinDate: "2023-01-01", tournaments, leaderboards: [],
  } } }));
  for (const t of tournaments) for (const user of t.users) Object.assign(user, {
    teamName: "Northern Alberta Championship Fantasy Curling Club", accountInitial: "I", backgroundColor: "blue",
    joinDate: "2023-01-01", profilePicture: null, isProfilePictureEnabled: false,
  });
  await page.route("**/api/users/*/career", route => route.fulfill({ json: { user: { id: "user1", username: "iceking", teamName: "Ice Kings" }, results: [], trophies: [], calculatedAt: "2026-10-06T12:00:00Z" } }));
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
    await expect(page.getByRole("table")).toHaveCount(0);
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
  const firstScoreBar = page.getByRole('region',{name:'Team performance'}).locator('ul > li').first().locator('svg rect').nth(1);
  await expect(firstScoreBar).toHaveAttribute('width','100');
  await page.getByLabel("My Picks only").check(); await expect(page.getByText("Showing 2 of 4 Teams")).toBeVisible();
  await page.getByLabel("Search Teams").fill("  brown  "); await expect(page.getByText("Showing 1 of 4 Teams")).toBeVisible();
  await expect(firstScoreBar).toHaveAttribute('width','100');
  await expect(page.getByRole("list", { name: "Team comparison" })).not.toContainText("Your contribution");
  await expect(page.getByRole("heading", { name: "Your Tournament total: 17 pts" })).toBeVisible();
  await page.getByLabel("Pool", { exact: true }).selectOption("B"); await expect(page.getByText("No Teams match your filters.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Compare by").selectOption("pickCount"); await page.getByRole("button", { name: "Descending" }).click();
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await expect(page.getByText("Ownership", { exact: false }).filter({ hasText: "Provisional" }).last()).toBeVisible();
  await expect(page).toHaveURL(/extra=kept/);
  await page.reload(); await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("upcoming");
  await page.goBack(); await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("active");
  await expect(page.getByLabel("Search Teams")).toHaveValue("");
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByLabel("Compare by").selectOption("winValue");
  await expect(page.getByRole("status").filter({ hasText: "Sorted by Wins" })).toContainText("descending");
  await page.getByRole("button", { name: "Descending", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sorted by Wins" })).toContainText("ascending");
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
  const compare = page.getByLabel("Compare by");
  await compare.focus(); await page.keyboard.press("w"); await page.keyboard.press("Enter");
  await compare.selectOption("winValue");
  const direction = page.getByRole("button", { name: "Descending", exact: true });
  await direction.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Sorted by Wins" })).toContainText("ascending");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Sorted by Wins" })).toContainText("descending");
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

for (const signedIn of [false, true]) for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`${signedIn ? "owner" : "anonymous"} Pick roster at ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, signedIn); await page.setViewportSize({ width, height: 900 });
    await page.goto("/users/iceking/tournaments/active");
    const chart = page.getByRole("region", { name: "Pick roster chart" });
    await expect(chart).toContainText("17 pts");
    await expect(chart).toContainText(`50.0% of ${signedIn ? 'your' : 'this user’s'} total`);
    await expect(chart.locator('svg')).toHaveCount(2);
    expect(await chart.locator('li').first().evaluate(el => getComputedStyle(el).color)).not.toBe('rgb(0, 0, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`roster-${signedIn ? "owner" : "anonymous"}-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
for (const width of [320, 1440]) test(`roster upcoming, completed and unavailable states at ${width}px`, async ({ page }, info) => {
  const ts = fixture(); const errors = await setup(page, true, ts); await page.setViewportSize({ width, height: 900 });
  await page.goto("/users/iceking/tournaments/upcoming");
  const chart = page.getByRole("region", { name: "Pick roster chart" });
  await expect(chart).toContainText("4.25 pts/win"); await expect(chart).not.toContainText("50.0%");
  await page.screenshot({ path: info.outputPath(`roster-upcoming-${width}.png`), fullPage: true });
  await page.goto("/users/iceking/tournaments/completed"); await expect(chart).toContainText("17 pts");
  await page.screenshot({ path: info.outputPath(`roster-completed-${width}.png`), fullPage: true });
  ts[0].insights!.teams[0].fantasyPoints = null;
  await page.goto("/users/iceking/tournaments/active"); await expect(chart).toContainText("Some Pick scores are unavailable");
  await expect(chart.locator('svg')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`roster-unavailable-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
test("all comparison metrics, unavailable values, scale and direction", async ({ page }) => {
  const ts = fixture(); ts[0].insights!.teams[0].fantasyPoints = 17; ts[0].insights!.teams[3].fantasyPoints = null;
  await setup(page, true, ts); await page.goto('/stats');
  const list = page.getByRole('list', { name: 'Team comparison' });
  for (const [metric, text] of [['fantasyPoints','17 pts'], ['winValue','4 wins'], ['weightValue','4.25 pts/win'], ['pickCount','8 Picks'], ['ownershipPercentage','80.0%']]) {
    await page.getByLabel('Compare by').selectOption(metric);
    await expect(list.locator('li').first()).toContainText(text);
    await expect(list.locator('li').first().locator('svg')).toHaveCount(1);
    await page.getByRole('button', { name: 'Descending', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sorted by' })).toContainText('ascending');
  }
  await page.getByLabel('Compare by').selectOption('fantasyPoints');
  await expect(list.locator('li').last()).toContainText('Unavailable');
  await expect(list.locator('li').last().locator('svg')).toHaveCount(0);
  await page.getByLabel('Search Teams').fill('brown');
  await expect(list.locator('li svg rect').nth(1)).toHaveAttribute('width','50');
});
