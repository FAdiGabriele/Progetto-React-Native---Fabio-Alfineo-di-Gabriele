import { Layout } from '@/constants/theme';

export type NewsLayout = { columns: number; horizontalMargin: number };

/**
 * Columns and horizontal margin of the news screen for a window width: one column
 * below the desktop threshold, otherwise at least the minimum number of columns,
 * plus one for every extra minimum card width that fits between the margins.
 */
export function getNewsLayout(width: number): NewsLayout {
  if (!Number.isFinite(width) || width < Layout.desktopMinWidth) {
    return { columns: 1, horizontalMargin: Layout.horizontalMargin.mobile };
  }
  const horizontalMargin = Layout.horizontalMargin.desktop;
  const gap = Layout.cardGap.desktop;
  const usableWidth = width - 2 * horizontalMargin + gap;
  const columns = Math.floor(usableWidth / (Layout.minCardWidth + gap));
  return { columns: Math.max(Layout.minColumns, columns), horizontalMargin };
}
