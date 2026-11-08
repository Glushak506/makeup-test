import { expectFilterApplied, expectPricesInRange, expectSameTotal } from '../src/assertions';
import { expect, test } from '../src/fixtures';
import { CategoryPage } from '../src/pages/category.page';
import { rangeFromPrices } from '../src/utils/price';

test.describe('Price filter: state in the URL', () => {
  test('the filter survives a page reload', async ({ category, page }) => {
    const range = rangeFromPrices(await category.readPrices());
    await category.filter.open();
    await category.filter.setRange(range);

    await category.syncWithProducts(range, () => page.reload({ waitUntil: 'domcontentloaded' }));

    await expectFilterApplied(category, range);
  });

  test('a copied link opens the same filtered list in a new tab', async ({ category, page, context, isMobile }) => {
    const range = rangeFromPrices(await category.readPrices());
    await category.filter.open();
    const applied = await category.filter.setRange(range);

    const sameLink = new CategoryPage(await context.newPage(), isMobile);
    const snapshot = await sameLink.openFilteredLink(page.url(), range);

    await expectFilterApplied(sameLink, range);
    expectSameTotal(snapshot.total, applied.total);
  });

  test('going to page 2 keeps the filter, and "Back" returns to page 1', async ({ category, page }) => {
    const range = rangeFromPrices(await category.readPrices());
    const { filter } = category;
    await filter.open();
    const pageOne = await filter.setRange(range);
    await filter.close();

    const pageTwo = await category.goToPage(2, range);

    expect(pageTwo.offset, 'Page 2 should request the next products').toBeGreaterThan(0);
    expect(pageTwo.firstProductId, 'Page 2 should show other products').not.toBe(pageOne.firstProductId);
    expectSameTotal(pageTwo.total, pageOne.total);
    await expectPricesInRange(category, range);

    const back = await category.syncWithProducts(range, () => page.goBack());
    expect(back.offset, '"Back" should return to the first products').toBe(0);
    await expectPricesInRange(category, range);
  });
});
