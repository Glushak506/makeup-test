export type PriceRange = { from?: number; to?: number };

export function parsePrice(text: string | null): number | null {
  const digits = (text ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export function isInRange(price: number, { from, to }: PriceRange): boolean {
  return (from === undefined || price >= from) && (to === undefined || price <= to);
}

export function parsePresetLabel(label: string): PriceRange {
  const numbers = (label.replace(/(\d)\s+(?=\d)/g, '$1').match(/\d+/g) ?? []).map(Number);
  if (/^Менше/i.test(label.trim())) return { to: numbers[0] };
  if (/^Більше/i.test(label.trim())) return { from: numbers[0] };
  return { from: numbers[0], to: numbers[1] };
}

export function chipText({ from, to }: PriceRange): string {
  return [from !== undefined && `від ${from}`, to !== undefined && `до ${to}`].filter(Boolean).join(' ');
}

export function rangeFromPrices(prices: number[]): Required<PriceRange> {
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    from: sorted[Math.floor(sorted.length * 0.25)],
    to: sorted[Math.floor(sorted.length * 0.75)],
  };
}

export function median(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
