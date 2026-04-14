import { expect, type Page } from "@playwright/test";
import { testIds } from "../../config/testids";

export class CommonPage {
  constructor(private readonly page: Page) {}

  async disableAnimations(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition-property: none !important;
          transition-duration: 0s !important;
          animation: none !important;
          scroll-behavior: auto !important;
        }
      `
    });
  }

  async waitForRoute(pathPrefix: string): Promise<void> {
    await expect.poll(() => this.page.url()).toContain(pathPrefix);
  }

  async waitForAppIdle(): Promise<void> {
    await this.page.getByTestId(testIds.global.appLoading).waitFor({ state: "hidden" }).catch(() => {});
    await this.page.getByTestId(testIds.global.skeleton).waitFor({ state: "hidden" }).catch(() => {});
    await this.page.getByTestId(testIds.global.modalBackdrop).waitFor({ state: "hidden" }).catch(() => {});
  }

  async clearUnsavedChangesDialogIfShown(): Promise<void> {
    const dialogCancel = this.page.getByTestId(testIds.global.unsavedDialogCancel);
    if (await dialogCancel.count()) {
      await dialogCancel.first().click();
      await dialogCancel.first().waitFor({ state: "hidden" });
    }
  }
}
