import { expectFilterApplied } from '../src/assertions';
import { expect, test } from '../src/fixtures';
import { median, rangeFromPrices } from '../src/utils/price';

test.describe('Price filter: "Від" and "До" fields', () => {
  test('only "Від": no product is cheaper than the bound', async ({ category }) => {
    const from = median(await category.readPrices());
    const unfilteredTotal = await category.totalCount();

    await category.filter.open();
    const snapshot = await category.filter.setFrom(from);

    await expectFilterApplied(category, { from });
    expect(snapshot.total).toBeLessThan(unfilteredTotal);
  });

  test('only "До": no product is more expensive than the bound', async ({ category }) => {
    const to = median(await category.readPrices());
    const unfilteredTotal = await category.totalCount();

    await category.filter.open();
    const snapshot = await category.filter.setTo(to);

    await expectFilterApplied(category, { to });
    expect(snapshot.total).toBeLessThan(unfilteredTotal);
  });

  test('both fields: the second bound narrows the list further', async ({ category }) => {
    const range = rangeFromPrices(await category.readPrices());
    const { filter } = category;

    await filter.open();
    const onlyFrom = await filter.setFrom(range.from);
    const both = await filter.setTo(range.to);

    await expectFilterApplied(category, range);
    expect(both.total).toBeLessThan(onlyFrom.total);
  });

  test('bounds are inclusive: "Від =" "До =" a real price finds that price', async ({ category }) => {
    const { filter } = category;
    const exactPrice = median(await category.readPrices());

    await filter.open();
    const snapshot = await filter.setRange({ from: exactPrice, to: exactPrice });

    expect(snapshot.total, `Nothing found for exactly ${exactPrice} ₴`).toBeGreaterThan(0);
    await expectFilterApplied(category, { from: exactPrice, to: exactPrice });
  });

  test('fields accept digits only', async ({ category }) => {
    const { filter } = category;
    await filter.open();

    for (const input of ['abc', '!@#$', '-100', '12.5', '1e5', '10 000']) {
      await test.step(`typing "${input}"`, async () => {
        await filter.fromInput.clear();
        await filter.fromInput.pressSequentially(input);
        await expect(filter.fromInput).toHaveValue(/^\d*$/);
      });
    }
  });

  test('a range above every price: empty list, no pagination, and a way back', async ({ category }) => {
    const { filter } = category;
    const from = Math.max(...(await category.readPrices())) * 1000;

    await filter.open();
    const snapshot = await filter.setFrom(from);

    expect(snapshot.total).toBe(0);
    expect(await category.totalCount()).toBe(0);
    await expect(category.cards).toHaveCount(0);
    await expect(category.pagination).toHaveCount(0);

    const afterReset = await filter.clearAll();
    expect(afterReset.total).toBeGreaterThan(0);
  });

  test('"Від" above "До": the page keeps working and shows no more than "Від" alone', async ({ category }) => {
    const { from, to } = rangeFromPrices(await category.readPrices());
    const { filter } = category;

    await filter.open();
    const onlyFrom = await filter.setFrom(to);
    const reversed = await filter.setTo(from);

    expect(reversed.total).toBeLessThanOrEqual(onlyFrom.total);
    expect(await category.totalCount()).toBe(reversed.total);
  });
});
