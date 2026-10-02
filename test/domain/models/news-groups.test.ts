import { appendGroups, normalizeForComparison, withoutDuplicates } from '@/domain/models/news-groups';
import type { Article, NewsGroup } from '@/domain/models/news-model';

function makeArticle(title: string, url: string, sourceName = 'ANSA.it'): Article {
  return { id: url, title, url, sourceName };
}

function makeDatedArticle(title: string, url: string, publishedAt: Date | string, sourceName = 'ANSA.it'): Article {
  return { ...makeArticle(title, url, sourceName), publishedAt: new Date(publishedAt) };
}

function group(key: string, ...articles: Article[]): NewsGroup<string> {
  return { key, articles };
}

function urlsOf(articles: readonly Article[]): string[] {
  return articles.map((article) => article.url);
}

const first = makeArticle('First', 'https://example.com/1');
const second = makeArticle('Second', 'https://example.com/2');
const third = makeArticle('Third', 'https://example.com/3');
const fourth = makeArticle('Fourth', 'https://example.com/4');

describe('normalizeForComparison', () => {
  it('trims the text, turns every run of white space into one space and lowers the case', () => {
    expect(normalizeForComparison('  Borse   EUROPEE\tin\n\nRialzo  ')).toBe('borse europee in rialzo');
    expect(normalizeForComparison('ANSA.it')).toBe('ansa.it');
  });

  it('returns an empty text for an empty or blank one', () => {
    expect(normalizeForComparison('')).toBe('');
    expect(normalizeForComparison(' \t\n ')).toBe('');
  });

  it('keeps punctuation, accents and single spaces', () => {
    expect(normalizeForComparison('Perché l’Italia vince: 3-0!')).toBe('perché l’italia vince: 3-0!');
    expect(normalizeForComparison('ÀNCORA Più')).toBe('àncora più');
  });
});

describe('withoutDuplicates', () => {
  it('keeps every candidate, in order, when none repeats an article, without changing the inputs', () => {
    const existing = [first];
    const candidates = [third, second, fourth];

    const kept = withoutDuplicates(existing, candidates);

    expect(kept).toEqual([third, second, fourth]);
    expect(kept).not.toBe(candidates);
    expect(existing).toEqual([first]);
    expect(candidates).toEqual([third, second, fourth]);
  });

  it('returns no articles for no candidates', () => {
    expect(withoutDuplicates([first, second], [])).toEqual([]);
    expect(withoutDuplicates([], [])).toEqual([]);
  });

  it('drops a candidate with the URL of an existing article, whatever its title, source and date', () => {
    const sameUrl = makeDatedArticle('Another title', first.url, '2026-09-20T10:00:00Z', 'la Repubblica');

    expect(withoutDuplicates([first], [sameUrl, second])).toEqual([second]);
  });

  it('drops a candidate with the title and source of an existing article, compared normalized, on the same day', () => {
    const existing = makeDatedArticle('Borse europee in rialzo', 'https://example.com/a', '2026-09-23T07:00:00Z', 'Il Sole 24 Ore');
    const sameStory = makeDatedArticle(
      '  BORSE   europee\tin  Rialzo ',
      'https://example.com/b',
      '2026-09-23T18:00:00Z',
      ' il  sole 24 ORE '
    );
    const otherTitle = makeDatedArticle('Borse europee in rialzo.', 'https://example.com/c', '2026-09-23T18:00:00Z', 'Il Sole 24 Ore');

    expect(urlsOf(withoutDuplicates([existing], [sameStory, otherTitle]))).toEqual(['https://example.com/c']);
  });

  it('keeps a candidate with the title of an existing article from another source or published on another day', () => {
    const existing = makeDatedArticle('Daily report', 'https://example.com/daily/23', '2026-09-23T07:00:00Z');
    const otherSource = makeDatedArticle('Daily report', 'https://example.com/other/23', '2026-09-23T09:00:00Z', 'la Repubblica');
    const nextDay = makeDatedArticle('Daily report', 'https://example.com/daily/24', '2026-09-24T07:00:00Z');

    expect(withoutDuplicates([existing], [otherSource, nextDay])).toEqual([otherSource, nextDay]);
  });

  it('compares the publication days in the device time zone', () => {
    const lateEvening = makeDatedArticle('Daily report', 'https://example.com/a', new Date(2026, 8, 23, 23, 59));
    const sameDay = makeDatedArticle('Daily report', 'https://example.com/b', new Date(2026, 8, 23, 0, 1));
    const afterMidnight = makeDatedArticle('Daily report', 'https://example.com/c', new Date(2026, 8, 24, 0, 1));

    expect(withoutDuplicates([lateEvening], [sameDay, afterMidnight])).toEqual([afterMidnight]);
  });

  it('treats two articles without a date as published on the same day, but not one with a date and one without', () => {
    const undated = makeArticle('Daily report', 'https://example.com/a');
    const alsoUndated = makeArticle('Daily report', 'https://example.com/b');
    const dated = makeDatedArticle('Daily report', 'https://example.com/c', '2026-09-23T07:00:00Z');

    expect(withoutDuplicates([undated], [alsoUndated])).toEqual([]);
    expect(withoutDuplicates([undated], [dated])).toEqual([dated]);
    expect(withoutDuplicates([dated], [undated])).toEqual([undated]);
  });

  it('keeps only the first of the candidates that repeat each other, by URL or by title and source', () => {
    const sameUrl = makeArticle('Second, updated', second.url);
    const sameTitle = makeArticle('SECOND', 'https://example.com/regional/2');

    expect(withoutDuplicates([], [second, sameUrl, third, sameTitle])).toEqual([second, third]);
  });

  it('drops a candidate that repeats a candidate dropped as a duplicate', () => {
    const updated = makeArticle('Updated title', first.url);
    const regional = makeArticle('Updated title', 'https://example.com/regional/1');

    expect(withoutDuplicates([first], [updated, regional, second])).toEqual([second]);
  });
});

describe('appendGroups', () => {
  it('extends the last group when the new group has its key, in order, without changing the current list', () => {
    const current = [group('top', first), group('more', second)];

    expect(appendGroups(current, [group('more', third, fourth)])).toEqual([
      group('top', first),
      group('more', second, third, fourth),
    ]);
    expect(current).toEqual([group('top', first), group('more', second)]);
  });

  it('adds a new group after the current ones when the key differs from the last one', () => {
    expect(appendGroups([group('top', first)], [group('more', second)])).toEqual([
      group('top', first),
      group('more', second),
    ]);
    expect(appendGroups([group('more', first), group('top', second)], [group('more', third)])).toEqual([
      group('more', first),
      group('top', second),
      group('more', third),
    ]);
  });

  it('appends to an empty list', () => {
    expect(appendGroups([], [group('more', first, second)])).toEqual([group('more', first, second)]);
  });

  it('drops the articles with the URL, or the title and source, of one already in the list', () => {
    const sameUrl = makeArticle('Updated first', 'https://example.com/1');
    const otherEdition = makeArticle('  FIRST ', 'https://example.com/regional/1', 'ansa.it');
    const otherSource = makeArticle('First', 'https://example.com/other/1', 'la Repubblica');

    expect(
      appendGroups([group('top', first), group('more', second)], [group('more', sameUrl, otherEdition, otherSource, third)])
    ).toEqual([group('top', first), group('more', second, otherSource, third)]);
  });

  it('keeps only the first of the duplicates inside the new page, also across its groups', () => {
    const thirdAgain = makeArticle('Third, updated', 'https://example.com/3');
    const thirdOtherEdition = makeArticle('third', 'https://example.com/regional/3');

    expect(
      appendGroups([group('top', first)], [group('more', third, thirdAgain), group('other', thirdOtherEdition, fourth)])
    ).toEqual([group('top', first), group('more', third), group('other', fourth)]);
  });

  it('returns the current list itself when it adds nothing', () => {
    const current = [group('top', first, second)];
    const duplicates = group(
      'more',
      makeArticle('Updated first', 'https://example.com/1'),
      makeArticle('SECOND', 'https://example.com/regional/2')
    );

    expect(appendGroups(current, [])).toBe(current);
    expect(appendGroups(current, [group('more')])).toBe(current);
    expect(appendGroups(current, [duplicates])).toBe(current);
    expect(appendGroups(current, [group('more', third)])).not.toBe(current);
  });

  it('drops an article with the title and source of one in the list only when published on the same day', () => {
    const daily = makeDatedArticle('Daily report', 'https://example.com/daily/23', '2026-09-23T07:00:00Z');
    const sameDay = makeDatedArticle('Daily report', 'https://example.com/regional/daily/23', '2026-09-23T18:00:00Z');
    const nextDay = makeDatedArticle('Daily report', 'https://example.com/daily/24', '2026-09-24T07:00:00Z');
    const current = [group('top', first, daily)];

    expect(appendGroups(current, [group('more', sameDay)])).toBe(current);
    expect(appendGroups(current, [group('more', sameDay, nextDay)])).toEqual([
      group('top', first, daily),
      group('more', nextDay),
    ]);
  });
});
