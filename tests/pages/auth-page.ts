import { type Page } from "@playwright/test";
import { testIds } from "../../config/testids";
import { CommonPage } from "./common-page";

export class AuthPage {
  private readonly common: CommonPage;

  constructor(private readonly page: Page) {
    this.common = new CommonPage(page);
  }

  get rawPage(): Page {
    return this.page;
  }

  async gotoSignIn(): Promise<void> {
    await this.page.goto("/sign-in");
    await this.common.waitForRoute("/sign-in");
    await this.common.waitForAppIdle();
  }

  async gotoSignUp(): Promise<void> {
    await this.page.goto("/sign-up");
    await this.common.waitForRoute("/sign-up");
    await this.common.waitForAppIdle();
  }

  async gotoResetPassword(): Promise<void> {
    await this.page.goto("/reset-password");
    await this.common.waitForRoute("/reset-password");
    await this.common.waitForAppIdle();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.page.getByTestId(testIds.auth.signInEmail).fill(email);
    await this.page.getByTestId(testIds.auth.signInPassword).fill(password);
    await this.page.getByTestId(testIds.auth.signInSubmit).click();
    await this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/current-user") && response.status() < 500
    );
    await this.common.waitForAppIdle();
  }

  async signUp(email: string, password: string): Promise<void> {
    await this.page.getByTestId(testIds.auth.signUpEmail).fill(email);
    await this.page.getByTestId(testIds.auth.signUpPassword).fill(password);
    await this.page.getByTestId(testIds.auth.signUpSubmit).click();
    await this.common.waitForAppIdle();
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.page.getByTestId(testIds.auth.resetEmail).fill(email);
    await this.page.getByTestId(testIds.auth.resetSubmit).click();
    await this.common.waitForAppIdle();
  }
}
