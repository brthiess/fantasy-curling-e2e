import { expect, type Page } from "@playwright/test";
import { testIds } from "../../config/testids";
import { CommonPage } from "./common-page";

export class LeaderboardPage {
  private readonly common: CommonPage;

  constructor(private readonly page: Page) {
    this.common = new CommonPage(page);
  }

  async gotoLeaderboard(tournamentId: string): Promise<void> {
    await this.page.goto(`/leaderboard/?tournamentId=${tournamentId}`);
    await this.common.waitForRoute("/leaderboard/");
    await this.common.waitForAppIdle();
    await expect(this.page.getByTestId(testIds.leaderboard.table)).toBeVisible();
  }

  async expectUserScore(username: string, expectedScore: string): Promise<void> {
    const row = this.page
      .getByTestId(testIds.leaderboard.row)
      .filter({ has: this.page.getByTestId(testIds.leaderboard.usernameCell).filter({ hasText: username }) })
      .first();

    await expect(row.getByTestId(testIds.leaderboard.scoreCell)).toHaveText(expectedScore);
  }

  async expectUserRank(username: string, expectedRank: string): Promise<void> {
    const row = this.page
      .getByTestId(testIds.leaderboard.row)
      .filter({ has: this.page.getByTestId(testIds.leaderboard.usernameCell).filter({ hasText: username }) })
      .first();

    await expect(row.getByTestId(testIds.leaderboard.rankCell)).toHaveText(expectedRank);
  }
}
