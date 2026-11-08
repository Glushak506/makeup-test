import { expectFilterApplied } from '../src/assertions';
import { expect, test } from '../src/fixtures';

test.describe('Price filter: presets', () => {
  test('each preset narrows the list to its own range', async ({ category }) => {
    const { filter } = category;
    const unfilteredTotal = await category.totalCount();
    await filter.open();

    const presets = await filter.readPresets();
    expect(presets.length, 'The filter should offer presets').toBeGreaterThan(0);

    for (const preset of presets) {
      await test.step(preset.label, async () => {
        const snapshot = await filter.clickPreset(preset);
        await expectFilterApplied(category, preset.range);
        expect(snapshot.total).toBeLessThan(unfilteredTotal);
      });
    }
  });

  test('the next preset replaces the previous one, ranges do not add up', async ({ category }) => {
    const { filter } = category;
    await filter.open();
    const presets = await filter.readPresets();
    const [first, second] = [presets[1], presets[presets.length - 2]];

    await filter.clickPreset(first);
    await filter.clickPreset(second);

    await expectFilterApplied(category, second.range);
  });
});
