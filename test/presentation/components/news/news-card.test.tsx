import { fireEvent, render, screen } from '@testing-library/react-native';

import { NewsCard, type NewsCardProps } from '@/presentation/components/news/news-card';
import { Colors } from '@/presentation/theme/theme';
import { ColorSchemeContext } from '@/presentation/hooks/use-color-scheme';

const TITLE = 'Parliament approves the budget law after a night session';
const SOURCE = 'ANSA.it';
const DESCRIPTION = 'The text now goes to the Senate for the final vote.';
const DATE = '24 Sep 2026, 14:30';
const AUTHOR = 'Jane Doe';
const META = `${DATE} · ${AUTHOR}`;
const LABEL = 'ANSA.it: Parliament approves the budget law after a night session';
const IMAGE_URL = 'https://www.ansa.it/webimages/article_1.jpg';
const THEMES = ['light', 'dark'] as const;

function cardElement(props: Partial<NewsCardProps> = {}) {
  return (
    <NewsCard
      title={TITLE}
      sourceName={SOURCE}
      description={DESCRIPTION}
      dateLabel={DATE}
      author={AUTHOR}
      accessibilityLabel={LABEL}
      onPress={jest.fn()}
      {...props}
    />
  );
}

function link() {
  return screen.getByRole('link', { name: LABEL });
}

function bodyTexts() {
  const body = screen.getByText(TITLE).parent;
  return (body?.children ?? []).map((child) => (typeof child === 'string' ? child : child.children.join('')));
}

describe('NewsCard', () => {
  it('shows the source, the title, the description and the meta line, in this order', async () => {
    await render(cardElement());

    expect(bodyTexts()).toEqual([SOURCE, TITLE, DESCRIPTION, META]);
  });

  it('joins the date and the author with a middle dot on a single line', async () => {
    await render(cardElement());

    expect(screen.getByText(META)).toHaveProp('numberOfLines', 1);
    expect(screen.queryByText(DATE)).not.toBeOnTheScreen();
    expect(screen.queryByText(AUTHOR)).not.toBeOnTheScreen();
  });

  it('shows only the date when the author is missing', async () => {
    await render(cardElement({ author: undefined }));

    expect(bodyTexts()).toEqual([SOURCE, TITLE, DESCRIPTION, DATE]);
  });

  it('shows only the author when the date is missing', async () => {
    await render(cardElement({ dateLabel: undefined }));

    expect(bodyTexts()).toEqual([SOURCE, TITLE, DESCRIPTION, AUTHOR]);
  });

  it('leaves out the meta line when both the date and the author are missing', async () => {
    await render(cardElement({ dateLabel: undefined, author: undefined }));

    expect(bodyTexts()).toEqual([SOURCE, TITLE, DESCRIPTION]);
  });

  it('leaves out the description when it is missing', async () => {
    await render(cardElement({ description: undefined }));

    expect(bodyTexts()).toEqual([SOURCE, TITLE, META]);
  });

  it('shows only the source and the title when every optional text is missing', async () => {
    await render(cardElement({ description: undefined, dateLabel: undefined, author: undefined }));

    expect(bodyTexts()).toEqual([SOURCE, TITLE]);
  });

  it('exposes the whole card as a link named by its accessibility label', async () => {
    await render(cardElement());

    expect(link()).toContainElement(screen.getByText(TITLE));
    expect(link()).toContainElement(screen.getByText(META));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('calls onPress when the card is pressed', async () => {
    const onPress = jest.fn();
    await render(cardElement({ onPress }));

    await fireEvent.press(link());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('limits the title to three lines, the description to two and the source and meta to one', async () => {
    await render(cardElement());

    expect(screen.getByText(TITLE)).toHaveProp('numberOfLines', 3);
    expect(screen.getByText(DESCRIPTION)).toHaveProp('numberOfLines', 2);
    expect(screen.getByText(SOURCE)).toHaveProp('numberOfLines', 1);
    expect(screen.getByText(META)).toHaveProp('numberOfLines', 1);
  });

  it('shows the article image above the texts', async () => {
    await render(cardElement({ imageUrl: IMAGE_URL }));

    const [image, body] = link().children;
    expect(image).toHaveProp('source', [expect.objectContaining({ uri: IMAGE_URL })]);
    expect(body).toBe(screen.getByText(TITLE).parent);
  });

  it('shows the image placeholder above the texts when there is no image URL', async () => {
    await render(cardElement());

    const [placeholder, body] = link().children;
    expect(placeholder).toHaveProp('aria-hidden', true);
    expect(screen.container.queryAll((element) => element.props.source !== undefined)).toHaveLength(0);
    expect(body).toBe(screen.getByText(TITLE).parent);
  });

  it.each(THEMES)('uses the %s theme colors for the card and its texts', async (scheme) => {
    const colors = Colors[scheme];
    await render(<ColorSchemeContext.Provider value={scheme}>{cardElement()}</ColorSchemeContext.Provider>);

    expect(link()).toHaveStyle({ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 });
    expect(screen.getByText(SOURCE)).toHaveStyle({ color: colors.tint });
    expect(screen.getByText(TITLE)).toHaveStyle({ color: colors.text });
    expect(screen.getByText(DESCRIPTION)).toHaveStyle({ color: colors.textSecondary });
    expect(screen.getByText(META)).toHaveStyle({ color: colors.textSecondary });
  });
});
