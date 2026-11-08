import { test as base } from '@playwright/test';
import { CategoryPage } from './pages/category.page';

const HIDE_OVERLAYS_CSS = `
  [class*="CookieBanner__cookie"],
  div:has(> [class*="RewardsTooltipContent__container"]) { display: none !important; }
`;

type Fixtures = {
  category: CategoryPage;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await context.addInitScript((css) => {
      const addStyle = () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.documentElement.append(style);
      };
      if (document.documentElement) addStyle();
      else document.addEventListener('DOMContentLoaded', addStyle);
    }, HIDE_OVERLAYS_CSS);
    await use(context);
  },

  category: async ({ page, isMobile }, use) => {
    const category = new CategoryPage(page, isMobile);
    await category.open();
    await use(category);
  },
});

export { expect } from '@playwright/test';
