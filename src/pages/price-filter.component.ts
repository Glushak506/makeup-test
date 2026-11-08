import { expect, type Locator, type Page } from '@playwright/test';
import { parsePresetLabel, type PriceRange } from '../utils/price';
import type { CategoryPage, ProductsSnapshot } from './category.page';

export class PriceFilter {
  private readonly page: Page;

  readonly header: Locator;
  readonly presets: Locator;
  readonly fromInput: Locator;
  readonly toInput: Locator;
  readonly chip: Locator;
  readonly clearAllLink: Locator;

  /** Mobile panel controls. */
  readonly openPanelButton: Locator;
  readonly applyButton: Locator;
  readonly clearButton: Locator;

  constructor(
    private readonly category: CategoryPage,
    private readonly isMobile: boolean,
  ) {
    this.page = category.page;
    this.header = this.page.locator('[class*="PriceSelector__button"]');
    this.presets = this.page.locator('[class*="PriceSelector__priceButton"]');
    const field = this.page.locator('[class*="PriceSelector__field "]');
    this.fromInput = field.filter({ hasText: 'Від' }).locator('input');
    this.toInput = field.filter({ hasText: 'До' }).locator('input');
    this.chip = this.page.locator('[class*="Tag__tag"]');
    this.clearAllLink = this.page.getByRole('button', { name: 'Зняти фільтри' });
    this.openPanelButton = this.page
      .locator('button[class*="FilterSortingControls__button"]')
      .filter({ hasText: 'Фільтр' });
    this.applyButton = this.page.getByRole('button', { name: 'Застосувати' });
    this.clearButton = this.page.getByRole('button', { name: 'Очистити' });
  }

  async open(): Promise<void> {
    if (this.isMobile && !(await this.presets.first().isVisible())) {
      await this.openPanelButton.click();
    }
    await expect(this.presets.first()).toBeVisible();
  }

  async close(): Promise<void> {
    if (!this.isMobile) return;
    await this.applyButton.click();
    await expect(this.presets.first()).toBeHidden();
  }

  async readPresets(): Promise<{ label: string; range: PriceRange }[]> {
    const labels = await this.presets.allTextContents();
    return labels.map((label) => ({ label, range: parsePresetLabel(label) }));
  }

  clickPreset({ label, range }: { label: string; range: PriceRange }): Promise<ProductsSnapshot> {
    return this.category.syncWithProducts(range, () => this.presets.filter({ hasText: label }).click());
  }

  async currentRange(): Promise<PriceRange> {
    const toBound = (value: string) => (value === '' ? undefined : Number(value));
    return { from: toBound(await this.fromInput.inputValue()), to: toBound(await this.toInput.inputValue()) };
  }

  private commit(input: Locator, value: number | undefined, range: PriceRange): Promise<ProductsSnapshot> {
    return this.category.syncWithProducts(range, async () => {
      await input.fill(value === undefined ? '' : String(value));
      await input.blur();
    });
  }

  async setFrom(from?: number): Promise<ProductsSnapshot> {
    return this.commit(this.fromInput, from, { ...(await this.currentRange()), from });
  }

  async setTo(to?: number): Promise<ProductsSnapshot> {
    return this.commit(this.toInput, to, { ...(await this.currentRange()), to });
  }

  async setRange({ from, to }: { from: number; to: number }): Promise<ProductsSnapshot> {
    await this.setFrom(from);
    return this.setTo(to);
  }

  async clearAll(): Promise<ProductsSnapshot> {
    if (this.isMobile) {
      await this.open();
      return this.category.syncWithProducts({}, () => this.clearButton.click());
    }
    return this.category.syncWithProducts({}, () => this.clearAllLink.click());
  }

  removeChip(): Promise<ProductsSnapshot> {
    return this.category.syncWithProducts({}, () => this.chip.click());
  }
}
