import { expect, type Page } from "@playwright/test";
import { testIds } from "../../config/testids";
import { CommonPage } from "./common-page";

export class TournamentPage {
  private readonly common: CommonPage;

  constructor(private readonly page: Page) {
    this.common = new CommonPage(page);
  }

  async joinFromTournamentsList(tournamentId: string): Promise<void> {
    await this.page.goto("/tournaments");
    await this.common.waitForRoute("/tournaments");
    await this.common.waitForAppIdle();

    const tournamentRow = this.page
      .getByTestId(testIds.tournaments.tournamentRow)
      .filter({ has: this.page.locator(`[data-tournament-id="${tournamentId}"]`) })
      .first();

    await tournamentRow.getByTestId(testIds.tournaments.tournamentCardJoin).click();
    await this.page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/current-user/tournament-registrations/${tournamentId}`) &&
        response.request().method() === "POST" &&
        response.ok()
    );
  }

  async gotoPicks(tournamentType: string, tournamentId: string): Promise<void> {
    await this.page.goto(`/my-picks/${tournamentType}/${tournamentId}`);
    await this.common.waitForRoute("/my-picks");
    await this.common.waitForAppIdle();
  }

  async makePicks(teamIds: string[]): Promise<void> {
    for (const teamId of teamIds) {
      await this.page
        .locator(`[data-testid="${testIds.tournaments.picksTeamToggle}"][data-team-id="${teamId}"]`)
        .click();
    }
  }

  async savePicks(tournamentId: string): Promise<void> {
    await this.page.getByTestId(testIds.tournaments.picksSaveButton).click();
    await this.page.waitForResponse(
      (response) =>
        response.url().includes(`/api/current-user/picks/${tournamentId}`) &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await expect(this.page.getByTestId(testIds.tournaments.picksSaveSuccess)).toBeVisible();
  }
}
