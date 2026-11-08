import { expectFilterApplied, expectFilterCleared } from '../src/assertions';
import { expect, test } from '../src/fixtures';
import { rangeFromPrices } from '../src/utils/price';

test.describe('Price filter: layout', () => {
  test('the "Вартість" section collapses and expands', async ({ category }) => {
    const { filter } = category;
    await filter.open();

    await filter.header.click();
    await expect(filter.presets.first()).toBeHidden();
    await expect(filter.fromInput).toBeHidden();

    await filter.header.click();
    await expect(filter.presets.first()).toBeVisible();
    await expect(filter.fromInput).toBeVisible();
  });

  test('desktop: the filter is always in the sidebar, with no apply step', async ({ category, isMobile }) => {
    test.skip(isMobile, 'Desktop layout only');
    const { filter } = category;

    await expect(filter.presets.first()).toBeVisible();
    await expect(filter.openPanelButton).toBeHidden();
    await expect(filter.applyButton).toBeHidden();
  });

  test('mobile: the panel opens by button and "Застосувати" closes it', async ({ category, isMobile }) => {
    test.skip(!isMobile, 'Mobile layout only');
    const { filter } = category;
    const range = rangeFromPrices(await category.readPrices());

    await expect(filter.presets.first()).toBeHidden();
    await filter.openPanelButton.click();
    await expect(filter.presets.first()).toBeVisible();

    await filter.setRange(range);
    await filter.close();

    await expect(filter.chip).toBeVisible();
    await expectFilterApplied(category, range);
  });

  test('mobile: "Очистити" resets the filter and closes the panel', async ({ category, isMobile }) => {
    test.skip(!isMobile, 'Mobile layout only');
    const { filter } = category;
    const range = rangeFromPrices(await category.readPrices());
    await filter.open();
    const applied = await filter.setRange(range);

    await category.syncWithProducts({}, () => filter.clearButton.click());

    await expect(filter.presets.first()).toBeHidden();
    await expectFilterCleared(category, applied.total);
  });
});
