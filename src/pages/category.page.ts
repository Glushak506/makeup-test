import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test';
import { chipText, parsePrice, type PriceRange } from '../utils/price';
import { PriceFilter } from './price-filter.component';

const CATEGORY_ID = 3;
const CATEGORY_PATH = `/ua/categorys/${CATEGORY_ID}/`;
const PRODUCTS_API_PATH = `/shop/v1/categories/${CATEGORY_ID}/products/`;

/** What the backend returned for the product list the page has just requested. */
export type ProductsSnapshot = {
  offset: number;
  total: number;
  firstProductId: number | null;
};

export type ProductCard = { title: string; price: number };

export class CategoryPage {
  readonly filter: PriceFilter;
  readonly total: Locator;
  /** Only the real results: promo blocks and review sliders in the grid ignore the filter. */
  readonly cards: Locator;
  readonly pagination: Locator;

  /** Shop API requests still running, used to tell when the page has settled. Ads are left out. */
  private apiRequestsInFlight = 0;
  private lastApiActivity = Date.now();

  constructor(
    readonly page: Page,
    isMobile: boolean,
  ) {
    this.filter = new PriceFilter(this, isMobile);
    this.total = page.locator('[class*="Products__total"]');
    this.cards = page.locator('[class*="Products__cards"] > [class*="ProductCard__cardContainer"]');
    this.pagination = page.locator('[class*="Pagination__pages"]');

    const track = (change: number) => (request: Request) => {
      const { hostname, pathname } = new URL(request.url());
      if (hostname !== 'makeup.com.ua' || !pathname.startsWith('/shop/v1/') || pathname.startsWith('/shop/v1/ads/')) return;
      this.apiRequestsInFlight += change;
      this.lastApiActivity = Date.now();
    };
    page.on('request', track(+1));
    page.on('requestfinished', track(-1));
    page.on('requestfailed', track(-1));
  }

  /** Opens the plain category. Its products come inside the HTML, so there is no response to wait for. */
  async open(): Promise<void> {
    await this.page.goto(CATEGORY_PATH, { waitUntil: 'domcontentloaded' });
    // "Attached", not "visible": the mobile layout keeps the total counter in the DOM but hides it.
    await expect(this.total, 'Category did not load. If it keeps happening, AWS WAF may be blocking this IP.').toBeAttached({
      timeout: 45_000,
    });
    await this.waitForHydration();
    await this.waitForStartupToFinish();
  }

  /** Opens a link that holds a filter: the first HTML is unfiltered, then the page loads the right products. */
  openFilteredLink(url: string, range: PriceRange): Promise<ProductsSnapshot> {
    return this.syncWithProducts(range, () => this.page.goto(url, { waitUntil: 'domcontentloaded' }));
  }

  /**
   * The server sends ready HTML, and React attaches its click handlers a moment later.
   * A click in between is lost silently, so wait for React to take over the filter.
   */
  private async waitForHydration(): Promise<void> {
    await this.page.waitForFunction(() => {
      const preset = document.querySelector('[class*="PriceSelector__priceButton"]');
      return !!preset && Object.keys(preset).some((key) => key.startsWith('__react'));
    });
  }

  /**
   * Hydration is not the end of the start-up. For about a second after it the app keeps initializing,
   * and a filter change made in that window makes the site send an extra unfiltered request and empty
   * the field it was typed in; once in ~40 runs the filter got lost entirely.
   * That start-up work keeps the browser busy, so the first idle moment means the page is ready.
   * Unlike a fixed pause, this adapts to the machine's speed; the timeout keeps it from hanging.
   */
  private async waitForStartupToFinish(): Promise<void> {
    await this.page.evaluate(() => new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 10_000 })));
  }

  /**
   * The main sync point of the suite. Runs an action, waits for the products response for exactly
   * this range, then waits until the UI shows that response. It replaces sleeps: as fast as the
   * site, and it never reads the previous results.
   *
   * The range matters: right after page load the site can also send a leftover unfiltered request,
   * so "the next response" is not necessarily the one the action caused.
   * It also proves the backend got the right values, otherwise this wait fails.
   */
  async syncWithProducts(range: PriceRange, action: () => Promise<unknown>): Promise<ProductsSnapshot> {
    const [response] = await Promise.all([
      this.page
        .waitForResponse((r) => this.isProductsResponse(r, range), { timeout: 30_000 })
        .catch(() => {
          throw new Error(`No products response for the range "${chipText(range) || 'no filter'}"`);
        }),
      action(),
    ]);
    expect(response.ok(), `Products request failed: ${response.url()}`).toBe(true);

    const body = await response.json();
    const firstProduct = body.products.find((item: { type: string }) => item.type === 'product');
    const snapshot: ProductsSnapshot = {
      offset: Number(new URL(response.url()).searchParams.get('offset') ?? 0),
      // Not body.total: without a filter it also counts products that are out of stock.
      total: body.availableCount,
      firstProductId: firstProduct?.id ?? null,
    };
    await this.waitForRender(snapshot);
    return snapshot;
  }

  private isProductsResponse(response: Response, { from, to }: PriceRange): boolean {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === PRODUCTS_API_PATH &&
      url.searchParams.get('priceFrom') === (from === undefined ? null : String(from)) &&
      url.searchParams.get('priceTo') === (to === undefined ? null : String(to))
    );
  }

  private async waitForRender({ total, firstProductId }: ProductsSnapshot): Promise<void> {
    await expect(this.total).toHaveText(new RegExp(`^${total}\\s`));
    if (firstProductId === null) {
      await expect(this.cards).toHaveCount(0);
    } else {
      await expect(this.cards.first().locator('a[href*="/product/"]').first()).toHaveAttribute(
        'href',
        new RegExp(`/product/${firstProductId}/`),
      );
    }
  }

  async totalCount(): Promise<number> {
    const count = parsePrice(await this.total.textContent());
    expect(count, 'Total counter holds no number').not.toBeNull();
    return count as number;
  }

  /** Products on the current page. Out-of-stock cards show no price, so they are left out. */
  async readCards(): Promise<ProductCard[]> {
    const raw = await this.cards.evaluateAll((cards) =>
      cards.map((card) => ({
        title: card.querySelector('[class*="ProductCard__title"]')?.textContent?.trim() ?? '',
        price: card.querySelector('[class*="Price__priceCurrent"]')?.textContent ?? null,
      })),
    );
    return raw.flatMap(({ title, price }) => {
      const parsed = parsePrice(price);
      return parsed === null ? [] : [{ title, price: parsed }];
    });
  }

  async readPrices(): Promise<number[]> {
    return (await this.readCards()).map((card) => card.price);
  }

  async goToPage(number: number, range: PriceRange): Promise<ProductsSnapshot> {
    const button = this.pagination.locator('[class*="Pagination__page"]').filter({ hasText: new RegExp(`^${number}$`) });
    // Scrolling to the pagination makes the site lazy-load blocks below it. When they appear, the
    // pagination jumps up: the mouse goes down on "2" and up on another element, so no click event
    // fires (about 1 run in 6). Scroll first, let the page load what the scroll started, then click.
    await button.scrollIntoViewIfNeeded();
    await this.waitForApiIdle();
    return this.syncWithProducts(range, () => button.click());
  }

  /** Waits until no shop API request is running and none has started for half a second. */
  private async waitForApiIdle(): Promise<void> {
    await expect
      .poll(() => this.apiRequestsInFlight === 0 && Date.now() - this.lastApiActivity >= 500, {
        message: 'The page kept loading data',
        timeout: 15_000,
      })
      .toBe(true);
  }
}
