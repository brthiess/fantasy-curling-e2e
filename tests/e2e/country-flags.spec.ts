import { expect, test, type Page } from "@playwright/test";
import { tournamentInsightsFixture } from "../../../fantasy-curling-frontend/src/test/insights-fixture";

async function setup(page: Page, signedIn: boolean, editable = false, regional = false) {
  await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
  const tournaments = tournamentInsightsFixture();
  // Synthetic countries exercise display contracts; these are not backfill data.
  for (const tournament of tournaments) {
    tournament.teams.forEach((team, i) => { team.countryCode = ["CA", "JP", "GB-SCT", undefined][i]; });
    tournament.currentUserTournamentData.picks = [{ teamId: "team0" }, { teamId: "team2" }];
    tournament.users[0].currentUserTournamentData = tournament.currentUserTournamentData;
    Object.assign(tournament.users[0], { teamName: "Ice Kings", accountInitial: "I", backgroundColor: "blue", joinDate: "2023-01-01", profilePicture: null, isProfilePictureEnabled: false });
  }
  tournaments[2].teams = tournaments[2].teams.map((team, i) => ({ ...team, countryCode: ["GB-ENG", "GB-WLS", "GB-SCT", undefined][i] }));
  if (regional) {
    for (const tournament of tournaments) tournament.teams.forEach((team, i) => {
      team.name = ["Dunstone", "Hasselborg", "McCarville", "Unverified"][i];
      team.countryCode = ["CA-AB", "SE", "CA-ON-N", undefined][i];
      Object.assign(team, { skipName: "Legacy duplicate must disappear" });
    });
  }
  if (editable) {
    tournaments[0].pickDeadline = new Date("2026-10-13T00:00:00Z");
    tournaments[0].startDate = new Date("2026-10-13T00:00:00Z");
  }
  const authUser = { id: "user1", email: "flags@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2024-01-01T00:00:00Z" };
  const expires = 4102444800;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "user1", exp: expires })).toString("base64url")}.test-signature`;
  if (signedIn) await page.addInitScript(({ token, expires, authUser }) => {
    localStorage.setItem("sb-career-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user: authUser }));
  }, { token, expires, authUser });
  await page.route("https://career-test.supabase.co/auth/v1/**", route => route.fulfill({ json: authUser }));
  await page.route("**/api/current-user", route => route.fulfill({ json: { success: true, signedIn, user: {
    ...authUser, id: signedIn ? "user1" : "", username: signedIn ? "iceking" : "", teamName: "Ice Kings", accountInitial: "I", totalPoints: 17,
    backgroundColor: "blue", globalRank: 1, profilePicture: null, isProfilePictureEnabled: false, joinDate: "2023-01-01", tournaments, leaderboards: [],
  } } }));
  await page.route("**/api/users/*/career", route => route.fulfill({ json: { user: { id: "user1", username: "iceking", teamName: "Ice Kings" }, results: [], trophies: [], calculatedAt: "2026-10-06T12:00:00Z" } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

async function capture(page: Page, path: string, fullPage = true) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({ ...viewport, height: viewport.height + 1 });
    await page.setViewportSize(viewport);
  }
  await page.clock.runFor(400);
  await page.screenshot({ path, fullPage, animations: "disabled" });
}

async function checkFlags(page: Page) {
  await expect.poll(() => page.locator(".team-flag img:visible").count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => {
    const dimensions = await page.locator(".team-flag img:visible").evaluateAll(images => images.map(image => {
      const img = image as HTMLImageElement, rect = img.getBoundingClientRect();
      return { loaded: img.complete && img.naturalWidth > 0, ratio: rect.width / rect.height, alt: img.alt };
    }));
    return dimensions.length > 0 && dimensions.every(img => img.loaded && Math.abs(img.ratio - 4 / 3) < .01 && img.alt);
  }).toBe(true);
}

for (const width of [320, 390, 768, 1440]) {
  for (const signedIn of [false, true]) test(`Stats flags ${signedIn ? "signed-in" : "anonymous"} ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, signedIn);
    await page.setViewportSize({ width, height: 900 }); await page.goto("/stats");
    await checkFlags(page);
    await page.getByText("+2 tied Teams", { exact: true }).first().click();
    await page.getByRole("article", { name: "Tournament overview chart" }).getByRole("button", { name: /Campbell.*Davies/ }).click();
    await capture(page, info.outputPath(`stats-${signedIn ? "signed-in" : "anonymous"}-${width}.png`));
    const teams = page.getByRole("region", { name: "Team performance" });
    await expect(teams.locator('img[alt="Scotland"]')).toHaveCount(1);
    await page.getByLabel("Search Teams").fill("campbell");
    await expect(teams.locator('img[alt="Scotland"]')).toHaveCount(1);
    await expect(teams.locator(".team-flag img")).toHaveCount(1);
    await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
    await checkFlags(page);
    await expect(page.locator('img[alt="England"]').first()).toBeVisible();
    await capture(page, info.outputPath(`stats-upcoming-${signedIn ? "signed-in" : "anonymous"}-${width}.png`));
    expect(errors).toEqual([]);
  });
  test(`User tournament flags ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, false);
    await page.setViewportSize({ width, height: 900 }); await page.goto("/users/iceking/tournaments/active");
    const roster = page.getByRole("region", { name: "Pick roster chart" });
    await expect(roster.locator('img[alt="Canada"]')).toHaveCount(1);
    await expect(roster.locator('img[alt="Scotland"]')).toHaveCount(1);
    await checkFlags(page);
    await capture(page, info.outputPath(`user-tournament-${width}.png`));
    expect(errors).toEqual([]);
  });
  test(`Weighted wins flags and fallback ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, true, true);
    await page.setViewportSize({ width, height: 900 }); await page.goto("/my-picks/weighted-wins/active");
    await expect(page.getByRole("heading", { name: "My Roster" })).toBeVisible();
    await checkFlags(page);
    await capture(page, info.outputPath(`picks-full-roster-${width}.png`));
    await page.getByTestId("remove-pick").nth(1).click();
    if (width < 1024) await page.getByTestId("choose-team-slot").click();
    const board = page.locator(".draft-board-panel");
    await expect(board.locator('img[alt="Scotland"]')).toBeVisible();
    await expect(board.getByTestId("draft-board-team").filter({ hasText: "Davies" }).locator(".team-flag")).toHaveText("TD");
    await checkFlags(page);
    await capture(page, info.outputPath(`picks-draft-board-${width}.png`), width >= 1024);
    await board.getByTestId("draft-board-team").filter({ hasText: "Campbell" }).click();
    await expect(page.locator('.team-flag.inline img[alt="Scotland"]')).toBeVisible();
    expect(errors).toEqual([]);
  });
  test(`Locked picks flags ${width}px`, async ({ page }, info) => {
    await setup(page, true); await page.setViewportSize({ width, height: 900 });
    await page.goto("/my-picks/weighted-wins/active");
    await expect(page.getByText("Picks Locked", { exact: true })).toBeVisible();
    await checkFlags(page);
    await capture(page, info.outputPath(`picks-locked-${width}.png`));
  });
}

test("broken flag asset retains initials in draft board", async ({ page }) => {
  await setup(page, true, true); await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/flags/jp.svg", route => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/my-picks/weighted-wins/active");
  await expect(page.getByTestId("draft-board-team").filter({ hasText: "Brown" }).locator(".team-flag")).toHaveText("TB");
});

for (const width of [390, 1440]) {
  test(`Canonical names and regional associations ${width}px`, async ({ page }, info) => {
    const errors = await setup(page, true, true, true);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/stats?tournamentId=active");
    const overview = page.getByRole("article", { name: "Tournament overview chart" });
    await expect(overview).toContainText("Dunstone · Alberta");
    await expect(overview).toContainText("McCarville · Northern Ontario");
    await expect(overview).not.toContainText("Legacy duplicate");
    await expect(overview).not.toContainText("Unverified ·");
    await expect(overview.locator('img[alt="Alberta"]')).toHaveAttribute("src", "/flags/ca-ab.svg");
    await expect(overview.locator('img[alt="Northern Ontario"]')).toHaveAttribute("src", "/flags/ca-on.svg");
    await checkFlags(page);
    await page.getByLabel("Search Teams").fill("northern ontario");
    const comparison = page.getByRole("region", { name: "Team performance" });
    await expect(comparison).toContainText("McCarville · Northern Ontario");
    await expect(comparison).not.toContainText("Dunstone");
    await capture(page, info.outputPath(`regional-stats-${width}.png`));
    await page.goto("/users/iceking/tournaments/active");
    const roster = page.getByRole("region", { name: "Pick roster chart" });
    await expect(roster).toContainText("McCarville · Northern Ontario");
    await expect(roster).not.toContainText("Legacy duplicate");
    await checkFlags(page);
    await capture(page, info.outputPath(`regional-user-${width}.png`));
    await page.goto("/my-picks/weighted-wins/active");
    await expect(page.getByRole("heading", { name: "My Roster" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Legacy duplicate");
    await page.getByTestId("remove-pick").nth(1).click();
    if (width < 1024) await page.getByTestId("choose-team-slot").click();
    const board = page.locator(".draft-board-panel");
    await board.locator('input[type="text"], input[type="search"]').fill("northern ontario");
    await expect(board.getByTestId("draft-board-team")).toHaveCount(1);
    await expect(board.getByTestId("draft-board-team")).toContainText("McCarville");
    await expect(board.getByTestId("draft-board-team")).toContainText("Northern Ontario");
    await expect(board).not.toContainText("Legacy duplicate");
    await checkFlags(page);
    await capture(page, info.outputPath(`regional-picks-${width}.png`), width >= 1024);
    expect(errors).toEqual([]);
  });
}
