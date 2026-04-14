import { test as base } from "@playwright/test";
import { AuthPage } from "../pages/auth-page";
import { CommonPage } from "../pages/common-page";
import { deterministicNowIso, smokeUser } from "../factories/seed-data";

type Fixtures = {
  authPage: AuthPage;
  commonPage: CommonPage;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.addInitScript((frozenEpoch) => {
      const fixedTime = Number(frozenEpoch);
      const RealDate = Date;

      class MockDate extends RealDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixedTime);
            return;
          }
          super(...(args as [string | number | Date]));
        }
        static now(): number {
          return fixedTime;
        }
      }

      window.Date = MockDate as DateConstructor;
    }, Date.parse(deterministicNowIso));

    await use(page);
  },
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  commonPage: async ({ page }, use) => {
    const commonPage = new CommonPage(page);
    await commonPage.disableAnimations();
    await use(commonPage);
  }
});

export const expect = test.expect;

export async function signInAsSmokeUser(authPage: AuthPage): Promise<void> {
  await authPage.gotoSignIn();
  await authPage.signIn(
    process.env.E2E_USER_EMAIL ?? smokeUser.email,
    process.env.E2E_USER_PASSWORD ?? smokeUser.password
  );
}
