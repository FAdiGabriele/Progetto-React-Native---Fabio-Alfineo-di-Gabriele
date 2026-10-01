import { Ionicons } from '@expo/vector-icons';
import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import { NewsImage } from '@/components/news/news-image';
import { Colors } from '@/constants/theme';
import { ColorSchemeContext } from '@/hooks/use-color-scheme';

const IMAGE_URL = 'https://www.ansa.it/webimages/article_1.jpg';
const OTHER_IMAGE_URL = 'https://www.ansa.it/webimages/article_2.jpg';
const ICON = String.fromCodePoint(Number(Ionicons.glyphMap['newspaper-outline']));
const THEMES = ['light', 'dark'] as const;

function images() {
  return screen.container.queryAll((element) => element.props.source !== undefined);
}

function placeholderIcon() {
  return screen.getByText(ICON, { includeHiddenElements: true });
}

describe('NewsImage', () => {
  it('shows a placeholder with a newspaper icon when there is no image URL', async () => {
    await render(<NewsImage />);

    expect(images()).toHaveLength(0);
    expect(screen.root).toContainElement(placeholderIcon());
    expect(placeholderIcon()).toHaveStyle({ fontSize: 40 });
  });

  it('hides the placeholder and its icon from accessibility', async () => {
    await render(<NewsImage />);

    expect(screen.root).toHaveProp('aria-hidden', true);
    expect(screen.root).toHaveProp('accessible', false);
    expect(screen.queryByText(ICON)).not.toBeOnTheScreen();
    expect(isHiddenFromAccessibility(placeholderIcon())).toBe(true);
  });

  it('shows the image of the URL, kept out of the accessibility tree', async () => {
    await render(<NewsImage imageUrl={IMAGE_URL} />);

    const [image] = images();
    expect(images()).toHaveLength(1);
    expect(image).toBe(screen.root);
    expect(image.props.source).toEqual([expect.objectContaining({ uri: IMAGE_URL })]);
    expect(image).toHaveProp('contentFit', 'cover');
    expect(image).toHaveProp('recyclingKey', IMAGE_URL);
    expect(image).toHaveProp('accessible', false);
    expect(image).toHaveProp('accessibilityLabel', '');
    expect(screen.queryByText(ICON, { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('gives the placeholder and the image the same full-width 16:9 box', async () => {
    await render(<NewsImage />);
    expect(screen.root).toHaveStyle({ width: '100%', aspectRatio: 16 / 9 });

    await screen.rerender(<NewsImage imageUrl={IMAGE_URL} />);
    expect(screen.root).toHaveStyle({ width: '100%', aspectRatio: 16 / 9 });
  });

  it('switches to the placeholder when the image fails to load', async () => {
    await render(<NewsImage imageUrl={IMAGE_URL} />);

    await fireEvent(images()[0], 'error', { nativeEvent: { error: 'HTTP 404' } });

    expect(images()).toHaveLength(0);
    expect(screen.root).toHaveProp('aria-hidden', true);
    expect(screen.root).toContainElement(placeholderIcon());
  });

  it('tries a new URL again after a failed one', async () => {
    await render(<NewsImage imageUrl={IMAGE_URL} />);
    await fireEvent(images()[0], 'error', { nativeEvent: { error: 'HTTP 404' } });

    await screen.rerender(<NewsImage imageUrl={OTHER_IMAGE_URL} />);

    expect(images()).toHaveLength(1);
    expect(images()[0].props.source).toEqual([expect.objectContaining({ uri: OTHER_IMAGE_URL })]);
  });

  it.each(THEMES)('uses the placeholder and icon colors of the %s theme', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <NewsImage />
      </ColorSchemeContext.Provider>
    );

    expect(screen.root).toHaveStyle({ backgroundColor: Colors[scheme].placeholder });
    expect(placeholderIcon()).toHaveStyle({ color: Colors[scheme].icon });
  });

  it.each(THEMES)('fills the frame of the image with the placeholder color of the %s theme while it loads', async (scheme) => {
    await render(
      <ColorSchemeContext.Provider value={scheme}>
        <NewsImage imageUrl={IMAGE_URL} />
      </ColorSchemeContext.Provider>
    );

    expect(images()).toHaveLength(1);
    expect(images()[0]).toHaveStyle({
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: Colors[scheme].placeholder,
    });
  });
});
