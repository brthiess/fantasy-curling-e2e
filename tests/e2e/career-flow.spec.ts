import { expect, test, type Page } from "@playwright/test";
import { careerFixture } from "../../../fantasy-curling-frontend/src/test/career-fixture";
import type { CareerDto } from "../../../fantasy-curling-frontend/src/types.js";

async function mockServices(page: Page, career: CareerDto = careerFixture()) {
  let signedIn = false;
  const authUser = { id: "user1", email: "career@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2024-01-01T00:00:00Z" };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "user1", exp: expires })).toString("base64url")}.test-signature`;
  await page.route("https://career-test.supabase.co/auth/v1/**", async route => {
    if (route.request().url().includes("/token")) {
      signedIn = true;
      await route.fulfill({ json: { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: expires, refresh_token: "test-refresh", user: authUser } });
    } else await route.fulfill({ json: authUser });
  });
  const tournamentData = {
    id: "entry1", rank: 1, totalPoints: 42, userTournamentRegistrationStatus: "registered",
    userTournamentRegistrationActionMessage: "View Picks", picks: [{ teamId: "team1" }],
    pickStatus: "complete", pickStatusMessage: "Complete",
  };
  const tournament = {
    id: "t1", name: "Autumn Championship", type: "weighted-wins", organizer: "grand-slam",
    image: "", imageAlt: "", startDate: "2026-09-10T00:00:00Z", endDate: "2026-09-20T12:00:00Z",
    pickDeadline: "2026-09-09T00:00:00Z", registrationOpensAt: "2026-09-01T00:00:00Z",
    totalNumberOfPicksToMake: 1, tournamentStatus: "COMPLETE", tournamentStatusMessage: "Complete",
    tournamentRegistrationStatus: "CLOSED", tournamentRegistrationStatusMessage: "Closed",
    currentUserTournamentData: tournamentData, typeMessage: "Weighted Wins", hasPools: false,
    insights: { eligibleEntryCount: 10, scoreSnapshotAt: "2026-10-06T12:00:00Z", teams: [{ teamId: "team1", fantasyPoints: 42, pickCount: 1, ownershipPercentage: 10 }] },
    rulesShort: "", rulesLong: "",
    users: [{ ...career.user, currentUserTournamentData: tournamentData }],
    teams: [{ id: "team1", name: "Team Example", skipName: "Example Skip", gender: 0,
      image: "", pointsPerWin: 1, wins: 42, pool: "", stats: { totalPicks: 1, totalPoints: 42, percentageOfTotalPicks: 100 } }],
  };
  await page.route("**/api/current-user", route => route.fulfill({ json: {
    success: true, signedIn,
    user: { ...career.user, id: signedIn ? "user1" : "", username: signedIn ? "iceking" : "", tournaments: [tournament], leaderboards: [] },
  } }));
  await page.route("**/api/users/*/career", route => route.fulfill({ json: career }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: {
      writeText: async (text: string) => { (window as unknown as { copiedRecap: string }).copiedRecap = text; },
    }, configurable: true });
  });
}

test("signed-in career, recap, and sharing flow", async ({ page }, testInfo) => {
  await mockServices(page);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/sign-in");
  await page.getByLabel("Email Address").fill("career@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("link", { name: "My career" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Latest Tournament recap/ })).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: "My career" }).click();
  await expect(page.getByRole("heading", { name: "Ice Kings", exact: true })).toBeVisible();
  await expect(page.locator('progress')).toHaveCount(careerFixture().trophies.filter(t => !t.earnedDate).length);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`owner-career-${width}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: "View recap for Autumn Championship", exact: true }).click();
  await expect(page.getByRole("region", { name: "Tournament recap" })).toContainText("You finished 1st");
  await page.getByRole("button", { name: "Share recap" }).click();
  await expect(page.getByRole("status")).toContainText("Recap copied!");
  expect(await page.evaluate(() => (window as unknown as { copiedRecap: string }).copiedRecap))
    .toContain("https://curlingdraft.com/users/iceking/tournaments/t1#recap");
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`career and recap layout at ${width}px`, async ({ page }, testInfo) => {
    await mockServices(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/users/iceking");
    await expect(page.getByRole("heading", { name: "Ice Kings", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "View" })).toHaveValue("career");
    await expect(page.locator('dl > div')).toHaveCount(5);
    await expect(page.locator('progress')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Best performance");
    await expect(page.locator("main")).not.toContainText("Calculated");
    await expect(page.locator("main")).not.toContainText("Corrected scores");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`career-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "View recap for Autumn Championship", exact: true }).click();
    const recap = page.getByRole("region", { name: "Tournament recap" });
    await expect(recap).toContainText("Ice Kings finished 1st");
    await expect(recap).not.toContainText("Calculated");
    await expect(recap).not.toContainText("Shared finishes use complete, valid entries");
    await expect(recap.locator("li [aria-hidden='true']")).toHaveCount(3);
    await expect.poll(async () => Math.round((await recap.boundingBox())?.y ?? -1)).toBe(96);
    await page.screenshot({ path: testInfo.outputPath(`recap-viewport-${width}.png`) });
    await expect(page.getByText("@iceking", { exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Behind Leader");
    await expect(page.locator('a[href="/users/iceking/"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`recap-${width}.png`), fullPage: true });
    await page.locator('a[href="/users/iceking/"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox", { name: "View" })).toHaveValue("career");
  });
}

test("empty, failure, retry and unknown-user states at narrow widths", async ({ page }, testInfo) => {
  const career = careerFixture();
  career.results = [];
  career.career = career.seasons[1].summary;
  career.seasons[0].summary = career.seasons[1].summary;
  career.trophies.forEach(trophy => { trophy.earnedDate = null; trophy.tournamentId = null; trophy.progress = 0; });
  await mockServices(page, career);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/users/iceking");
  await expect(page.getByText("No completed tournaments yet.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("career-empty-320.png"), fullPage: true });
  await page.route("**/api/users/*/career", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Career results could not be loaded");
  await page.screenshot({ path: testInfo.outputPath("career-error-320.png"), fullPage: true });
  await page.unroute("**/api/users/*/career");
  await page.route("**/api/users/*/career", route => route.fulfill({ json: career }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Ice Kings", exact: true })).toBeVisible();
  await page.route("**/api/users/*/career", route => route.fulfill({ status: 404, json: { error: "User not found." } }));
  await page.goto("/users/missing");
  await expect(page.getByRole("alert")).toContainText("User not found.");
  await page.screenshot({ path: testInfo.outputPath("career-unknown-320.png"), fullPage: true });
});

test("anonymous public profile and recap fit desktop and mobile", async ({ page }, testInfo) => {
  await mockServices(page);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/users/iceking");
  await expect(page.getByRole("heading", { name: "Ice Kings", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "View" })).toHaveValue("career");
  await page.screenshot({ path: testInfo.outputPath("career-desktop.png"), fullPage: true });
  await page.getByRole("combobox", { name: "View" }).selectOption("2025-2026");
  await expect(page.getByText("No completed tournaments this season.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Win Tournament", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "View" }).selectOption("career");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("career-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "View recap for Autumn Championship", exact: true }).click();
  const recap = page.getByRole("region", { name: "Tournament recap" });
  await expect(recap).toContainText("Ice Kings finished 1st");
  await expect(page.getByRole("button", { name: "Share recap" })).toHaveCount(0);
  await recap.screenshot({ path: testInfo.outputPath("recap-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Direct shared links must also work on a fresh page load.
  await page.reload();
  await expect(recap).toContainText("Ice Kings finished 1st");
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 390, 768, 1024, 1440]) test(`all earned trophy icons at ${width}px`, async ({ page }, info) => {
  const career = careerFixture(); career.results[0].earnedTrophyIds = career.trophies.map(t => t.id);
  career.trophies.forEach(t => { t.earnedDate = career.results[0].endDate; t.tournamentId = "t1"; t.progress = t.target; });
  await mockServices(page, career); const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({width,height:900}); await page.goto('/users/iceking/tournaments/t1#recap');
  const recap = page.getByRole('region',{name:'Tournament recap'});
  await expect(recap.getByRole('heading',{name:'Trophies earned'})).toBeVisible();
  const icons = recap.locator('li .material-symbols-outlined');
  await expect(icons).toHaveCount(career.trophies.length); expect(new Set(await icons.allTextContents()).size).toBe(career.trophies.length);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`trophy-icons-${width}.png`),fullPage:true});
  await page.goto('/users/iceking/');
  const cabinet = page.getByRole('region', { name: 'Trophy cabinet' });
  await expect(cabinet.locator('article')).toHaveCount(career.trophies.length);
  await expect(cabinet.locator('progress')).toHaveCount(0);
  for (const trophy of career.trophies) await expect(cabinet.getByRole('heading', { name: trophy.name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`earned-cabinet-${width}.png`),fullPage:true});
  expect(errors).toEqual([]);
});

test("long completed history retains all results and filters by season", async ({ page }, info) => {
  const career = careerFixture();
  career.results = Array.from({ length: 12 }, (_, i) => ({
    ...career.results[0], tournamentId: `history-${i}`, sharedFinish: i < 2 ? 12 : i + 12,
    fieldSize: 1250, tournamentName: `Canadian Open Championship and Invitational ${2026 - i}`,
    season: i < 6 ? "2026-2027" : "2025-2026",
    endDate: new Date(Date.UTC(2026, 9 - i, 1)).toISOString(),
  }));
  await mockServices(page, career);
  await page.goto('/users/iceking/');
  const results = page.getByRole('region', { name: 'Completed results' });
  await expect(results.getByRole('listitem')).toHaveCount(12);
  await expect(results.getByLabel('Rank 12 of 1250', { exact: true })).toHaveCount(2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await results.screenshot({ path: info.outputPath(`history-${width}.png`) });
  }
  await page.getByRole('combobox', { name: 'View' }).selectOption('2025-2026');
  await expect(results.getByRole('listitem')).toHaveCount(6);
  await expect(results.getByRole('listitem').first()).toContainText('Invitational 2020');
  await expect(page.getByText('Win Tournament', { exact: true })).toBeVisible();
});
