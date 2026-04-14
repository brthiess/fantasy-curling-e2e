import { expect, type Page } from "@playwright/test";
import { testIds } from "../../config/testids";
import { CommonPage } from "./common-page";

export class AccountPage {
  private readonly common: CommonPage;

  constructor(private readonly page: Page) {
    this.common = new CommonPage(page);
  }

  async goto(): Promise<void> {
    await this.page.goto("/account/");
    await this.common.waitForRoute("/account/");
    await this.common.waitForAppIdle();
  }

  async updateSettings(teamName: string, backgroundColor: string): Promise<void> {
    await this.page.getByTestId(testIds.account.teamNameInput).fill(teamName);
    await this.page
      .getByTestId(testIds.account.backgroundColorInput)
      .fill(backgroundColor);
    await this.page.getByTestId(testIds.account.saveButton).click();

    await this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/current-user/settings") &&
        response.request().method() === "POST" &&
        response.ok()
    );

    await expect(this.page.getByTestId(testIds.account.saveSuccess)).toBeVisible();
  }
}
