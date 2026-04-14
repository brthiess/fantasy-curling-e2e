import { AccountPage } from "../pages/account-page";
import { LeaderboardPage } from "../pages/leaderboard-page";
import { TournamentPage } from "../pages/tournament-page";
import { seedIds, seededPicksOrder, smokeUser } from "../factories/seed-data";
import { signInAsSmokeUser, test } from "../fixtures/test-fixtures";

const openTournamentId = seedIds.tournaments.open.toHexString();

test.describe("golden-path smoke", () => {
  test("sign up page and flow", async ({ authPage }) => {
    await authPage.gotoSignUp();
    await authPage.signUp(`new-${Date.now()}@example.com`, "Password123!");
  });

  test("sign in", async ({ authPage, commonPage }) => {
    await signInAsSmokeUser(authPage);
    await commonPage.waitForAppIdle();
    await commonPage.waitForRoute("/");
  });

  test("password reset page and flow", async ({ authPage }) => {
    await authPage.gotoResetPassword();
    await authPage.requestPasswordReset(smokeUser.email);
  });

  test("join tournament", async ({ authPage }) => {
    await signInAsSmokeUser(authPage);
    const tournamentPage = new TournamentPage(authPage.rawPage);
    await tournamentPage.joinFromTournamentsList(openTournamentId);
  });

  test("make 6 picks and save picks", async ({ authPage }) => {
    await signInAsSmokeUser(authPage);
    const tournamentPage = new TournamentPage(authPage.rawPage);
    await tournamentPage.gotoPicks("weighted-wins", openTournamentId);
    await tournamentPage.makePicks(
      seededPicksOrder.map((id) => id.toHexString()).slice(0, 6)
    );
    await tournamentPage.savePicks(openTournamentId);
  });

  test("verify leaderboard score", async ({ authPage }) => {
    await signInAsSmokeUser(authPage);
    const leaderboardPage = new LeaderboardPage(authPage.rawPage);
    await leaderboardPage.gotoLeaderboard(openTournamentId);
    await leaderboardPage.expectUserRank(smokeUser.username, "1");
    await leaderboardPage.expectUserScore(smokeUser.username, "22.1");
  });

  test("update account settings", async ({ authPage }) => {
    await signInAsSmokeUser(authPage);
    const accountPage = new AccountPage(authPage.rawPage);
    await accountPage.goto();
    await accountPage.updateSettings("Brad Test Rink Updated", "#1d3c88");
  });
});

test.describe("future flow placeholders", () => {
  test("private tournament creation", async () => {
    test.fixme();
  });
  test("invite users", async () => {
    test.fixme();
  });
  test("payments and upgrade", async () => {
    test.fixme();
  });
  test("admin pages", async () => {
    test.fixme();
  });
});
