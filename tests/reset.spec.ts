import { expectFilterCleared, expectPricesInRange } from '../src/assertions';
import { expect, test } from '../src/fixtures';
import { rangeFromPrices } from '../src/utils/price';

test.describe('Price filter: reset', () => {
  test('the reset control removes the filter', async ({ category }) => {
    const { filter } = category;
    const range = rangeFromPrices(await category.readPrices());
    await filter.open();
    const applied = await filter.setRange(range);

    await filter.clearAll();

    await expectFilterCleared(category, applied.total);
  });

  test('the chip removes the filter', async ({ category }) => {
    const { filter } = category;
    const range = rangeFromPrices(await category.readPrices());
    await filter.open();
    const applied = await filter.setRange(range);
    await filter.close();

    await filter.removeChip();

    await expectFilterCleared(category, applied.total);
  });

  test('an emptied field drops its bound and keeps the other one', async ({ category }) => {
    const { filter } = category;
    const range = rangeFromPrices(await category.readPrices());
    await filter.open();
    const applied = await filter.setRange(range);

    const snapshot = await filter.setTo(undefined);

    await expectPricesInRange(category, { from: range.from });
    expect(snapshot.total).toBeGreaterThan(applied.total);
  });
});
