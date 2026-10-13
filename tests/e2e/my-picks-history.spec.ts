import { expect, test, type Page } from "@playwright/test";
import { tournamentInsightsFixture } from "../../../fantasy-curling-frontend/src/test/insights-fixture";

async function setup(page: Page, signedIn: boolean) {
  await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
  const tournaments = tournamentInsightsFixture();
  for (const tournament of tournaments) {
    tournament.currentUserTournamentData.picks = [{ teamId: "team0" }, { teamId: "team2" }];
  }
  tournaments[0].tournamentStatus = "IN_PROGRESS" as any;
  tournaments[2].tournamentStatus = "NOT_STARTED" as any;
  for (const tournament of tournaments) tournament.currentUserTournamentData = JSON.parse(JSON.stringify(tournament.currentUserTournamentData));
  const bracket = JSON.parse(JSON.stringify(tournaments[1]));
  bracket.id = "bracket";
  bracket.name = "Previous Bracket Championship";
  bracket.type = "bracket";
  bracket.currentUserTournamentData.bracket = { rounds: [{ id: 1, name: "Final", games: [{ id: 1, team1: bracket.teams[0], team2: bracket.teams[1], pickedWinner: bracket.teams[0], actualWinner: bracket.teams[0] }] }] };
  tournaments.push(bracket);
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


for (const width of [320, 390, 768, 1024, 1280, 1440]) test(`My Picks history and layout ${width}px`, async ({ page }) => {
  const errors = await setup(page, true);
  await page.setViewportSize({ width, height: 900 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/my-tournaments/");
  if (width < 768) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.clock.runFor(400);
    await expect(page.locator("aside").getByRole("link", { name: "My Picks", exact: true })).toHaveAttribute("href", "/my-picks/weighted-wins/active");
    await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/navigation-${width}.png` });
    await page.getByRole("button", { name: "Close navigation menu" }).click();
    await page.clock.runFor(400);
  } else {
    await expect(page.locator("nav").getByRole("link", { name: "My Picks", exact: true })).toBeVisible();
  }
  const liveCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "Live Now" }) });
  await expect(liveCard.getByRole("link", { name: "My Picks", exact: true })).toHaveAttribute("href", "/my-picks/weighted-wins/active");
  await liveCard.getByRole("button", { name: /^Share/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Autumn Championship");
  await page.clock.runFor(5100);
  for (const link of await liveCard.locator("a:visible, button:visible").all()) {
    const box = await link.boundingBox();
    if (box && (await link.innerText()).trim()) expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("link", { name: "My Picks", exact: true }).filter({ hasText: "My Picks" }).first()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/tournaments-${width}.png`, fullPage: true });
  await liveCard.getByRole("link", { name: "My Picks", exact: true }).click();
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("active");
  await expect(page.getByText("Picks Locked", { exact: true })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/picks-locked-${width}.png`, fullPage: true });
  await page.getByLabel("Tournament", { exact: true }).selectOption("completed");
  await expect(page.getByRole("heading", { name: "Previous Championship" })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("active");
  await page.goForward();
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("completed");
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await expect(page.getByRole("heading", { name: "Winter Championship" })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/picks-editable-${width}.png`, fullPage: true });
  // Removing a saved team creates a real unsaved roster.
  await page.getByTestId("remove-pick").first().click();
  await page.getByLabel("Tournament", { exact: true }).selectOption("completed");
  await expect(page.getByRole("dialog", { name: "Unsaved picks" })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/unsaved-${width}.png`, fullPage: true });
  await page.getByTestId("unsaved-dialog-cancel").click();
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("upcoming");
  const back = page.goBack();
  await expect(page.getByRole("dialog", { name: "Unsaved picks" })).toBeVisible();
  await page.getByTestId("unsaved-dialog-cancel").click();
  await back;
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("upcoming");
  await page.getByLabel("Tournament", { exact: true }).selectOption("completed");
  await page.getByTestId("unsaved-dialog-confirm").click();
  await expect(page.getByLabel("Tournament", { exact: true })).toHaveValue("completed");
  await page.getByLabel("Tournament", { exact: true }).selectOption("upcoming");
  await expect(page.getByTestId("remove-pick")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Tournament", { exact: true }).selectOption("bracket");
  await expect(page.locator(".inner-bracket")).toBeVisible();
  await expect(page.getByText("Picks Locked", { exact: true })).toBeVisible();
  await expect(page.locator(".picks-button-container")).toBeHidden();
  await page.screenshot({ animations: "disabled", path: `../tmp/my-picks-history/picks-bracket-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
