import { expect, test } from '@playwright/test';
import type { CategoryPage } from './pages/category.page';
import { chipText, isInRange, type PriceRange } from './utils/price';

const MAX_OUTLIERS_PER_PAGE = 2;

export async function expectPricesInRange(category: CategoryPage, range: PriceRange): Promise<void> {
  const cards = await category.readCards();
  const outliers = cards.filter((card) => !isInRange(card.price, range));

  for (const { title, price } of outliers) {
    test.info().annotations.push({
      type: 'price-outlier',
      description: `"${title}" costs ${price} ₴, range is ${chipText(range)}`,
    });
  }

  const details = outliers.map((c) => `${c.title}: ${c.price}`).join(', ');
  expect(outliers.length, `Cards out of range "${chipText(range)}": ${details}`).toBeLessThanOrEqual(MAX_OUTLIERS_PER_PAGE);
}

export function expectSameTotal(actual: number, expected: number): void {
  const allowedDrift = Math.ceil(expected * 0.01);
  expect(Math.abs(actual - expected), `Totals differ too much: ${actual} and ${expected}`).toBeLessThanOrEqual(allowedDrift);
}

export async function expectFilterApplied(category: CategoryPage, range: PriceRange): Promise<void> {
  const { filter, page } = category;
  const asParam = (value?: number) => (value === undefined ? null : String(value));

  const hash = new URLSearchParams(new URL(page.url()).hash.slice(1));
  expect(hash.get('price_from'), 'price_from in the URL').toBe(asParam(range.from));
  expect(hash.get('price_to'), 'price_to in the URL').toBe(asParam(range.to));

  await expect(filter.fromInput).toHaveValue(asParam(range.from) ?? '');
  await expect(filter.toInput).toHaveValue(asParam(range.to) ?? '');
  await expect(filter.chip).toHaveText(new RegExp(`^${chipText(range)}`));

  await expectPricesInRange(category, range);
}

export async function expectFilterCleared(category: CategoryPage, filteredTotal: number): Promise<void> {
  const { filter, page } = category;
  expect(page.url(), 'URL still holds price params').not.toMatch(/price_(from|to)=/);
  await expect(filter.chip).toHaveCount(0);
  await expect(filter.fromInput).toHaveValue('');
  await expect(filter.toInput).toHaveValue('');
  expect(await category.totalCount(), 'Total should grow back after a reset').toBeGreaterThan(filteredTotal);
}
