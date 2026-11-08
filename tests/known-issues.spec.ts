import { expect, test } from '../src/fixtures';
import { rangeFromPrices } from '../src/utils/price';

test.describe('Price filter: known issues', () => {
  test('a value typed in "До" survives the "Від" update', async ({ category }) => {
    test.fail(true, 'BUG: the update after "Від" wipes what the user is already typing in "До"');

    const { from, to } = rangeFromPrices(await category.readPrices());
    const { filter } = category;
    await filter.open();

    await category.syncWithProducts({ from }, async () => {
      await filter.fromInput.fill(String(from));
      await filter.fromInput.press('Tab');
      await filter.toInput.pressSequentially(String(to));
    });

    await expect(filter.toInput).toHaveValue(String(to), { timeout: 3_000 });
  });
});
