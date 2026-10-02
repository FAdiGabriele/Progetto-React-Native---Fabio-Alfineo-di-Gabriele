import { getNewsLayout } from '@/presentation/utils/layout';

const MOBILE = { columns: 1, horizontalMargin: 24 };
const DESKTOP_MARGIN = 32;
const DESKTOP_GAP = 16;
const MIN_CARD_WIDTH = 320;

describe('getNewsLayout', () => {
  it('uses one column and the mobile margin below the desktop threshold', () => {
    expect(getNewsLayout(0)).toEqual(MOBILE);
    expect(getNewsLayout(320)).toEqual(MOBILE);
    expect(getNewsLayout(390)).toEqual(MOBILE);
    expect(getNewsLayout(767)).toEqual(MOBILE);
    expect(getNewsLayout(767.9)).toEqual(MOBILE);
  });

  it('uses two columns and the desktop margin from the threshold on, up to the room for a third column', () => {
    expect(getNewsLayout(768)).toEqual({ columns: 2, horizontalMargin: DESKTOP_MARGIN });
    expect(getNewsLayout(1024)).toEqual({ columns: 2, horizontalMargin: DESKTOP_MARGIN });
    expect(getNewsLayout(1055)).toEqual({ columns: 2, horizontalMargin: DESKTOP_MARGIN });
    expect(getNewsLayout(1056)).toEqual({ columns: 3, horizontalMargin: DESKTOP_MARGIN });
    expect(getNewsLayout(1280)).toEqual({ columns: 3, horizontalMargin: DESKTOP_MARGIN });
  });

  it('adds a column for every extra minimum card width that fits between the margins', () => {
    expect(getNewsLayout(1391).columns).toBe(3);
    expect(getNewsLayout(1392).columns).toBe(4);
    expect(getNewsLayout(1440).columns).toBe(4);
    expect(getNewsLayout(1727).columns).toBe(4);
    expect(getNewsLayout(1728).columns).toBe(5);
    expect(getNewsLayout(1920).columns).toBe(5);
    expect(getNewsLayout(2560).columns).toBe(7);
  });

  it('keeps cards at least 320 points wide in at least two columns and never leaves room for one more', () => {
    for (let width = 768; width <= 4000; width += 1) {
      const { columns, horizontalMargin } = getNewsLayout(width);
      const usableWidth = width - 2 * horizontalMargin;
      const cardWidth = (usableWidth - (columns - 1) * DESKTOP_GAP) / columns;
      const cardWidthWithOneMore = (usableWidth - columns * DESKTOP_GAP) / (columns + 1);

      expect(horizontalMargin).toBe(DESKTOP_MARGIN);
      expect(columns).toBeGreaterThanOrEqual(2);
      expect(cardWidth).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
      expect(cardWidthWithOneMore).toBeLessThan(MIN_CARD_WIDTH);
    }
  });

  it('gives the narrowest desktop window two cards of 344 points and the first window with three columns cards of 320', () => {
    const cardWidth = (width: number) => {
      const { columns, horizontalMargin } = getNewsLayout(width);
      return (width - 2 * horizontalMargin - (columns - 1) * DESKTOP_GAP) / columns;
    };

    expect(cardWidth(768)).toBe(344);
    expect(cardWidth(1056)).toBe(MIN_CARD_WIDTH);
  });

  it('treats non-finite and negative widths as the mobile layout', () => {
    for (const width of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -1920]) {
      expect(getNewsLayout(width)).toEqual(MOBILE);
    }
  });
});
