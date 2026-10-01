import type { Article } from '@/domain/models/news-model';
import { createOpenArticle } from '@/domain/use-cases/open-article';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeArticle(slug: string): Article {
  return { id: `article-${slug}`, title: `Title ${slug}`, url: `https://example.com/${slug}`, sourceName: 'ANSA.it' };
}

const first = makeArticle('first');
const second = makeArticle('second');

describe('createOpenArticle', () => {
  let openUrl: jest.Mock<Promise<boolean>, [string]>;

  beforeEach(() => {
    openUrl = jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true);
  });

  it('opens the URL of the article and gives opened when the opener succeeds', async () => {
    await expect(createOpenArticle(openUrl)(first)).resolves.toBe('opened');

    expect(openUrl.mock.calls).toEqual([['https://example.com/first']]);
  });

  it('gives failed when the opener answers false', async () => {
    openUrl.mockResolvedValueOnce(false);

    await expect(createOpenArticle(openUrl)(first)).resolves.toBe('failed');
  });

  it('gives failed when the opener rejects', async () => {
    openUrl.mockRejectedValueOnce(new Error('no browser'));

    await expect(createOpenArticle(openUrl)(first)).resolves.toBe('failed');
  });

  it('ignores a request made while another article is opening and accepts the next one once it is over', async () => {
    const opening = defer<boolean>();
    openUrl.mockReturnValueOnce(opening.promise);
    const openArticle = createOpenArticle(openUrl);

    const firstOutcome = openArticle(first);
    await expect(openArticle(second)).resolves.toBe('ignored');

    expect(openUrl.mock.calls).toEqual([['https://example.com/first']]);

    opening.resolve(true);
    await expect(firstOutcome).resolves.toBe('opened');
    await expect(openArticle(second)).resolves.toBe('opened');

    expect(openUrl.mock.calls).toEqual([['https://example.com/first'], ['https://example.com/second']]);
  });

  it.each([
    { failure: 'answers false', settle: (opening: Deferred<boolean>) => opening.resolve(false) },
    { failure: 'rejects', settle: (opening: Deferred<boolean>) => opening.reject(new Error('no browser')) },
  ])('accepts a new request after an opener that $failure', async ({ settle }) => {
    const opening = defer<boolean>();
    openUrl.mockReturnValueOnce(opening.promise);
    const openArticle = createOpenArticle(openUrl);

    const firstOutcome = openArticle(first);
    await expect(openArticle(second)).resolves.toBe('ignored');
    settle(opening);

    await expect(firstOutcome).resolves.toBe('failed');
    await expect(openArticle(second)).resolves.toBe('opened');
    expect(openUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps a separate guard for every use case it builds', async () => {
    const opening = defer<boolean>();
    openUrl.mockReturnValueOnce(opening.promise);

    const pending = createOpenArticle(openUrl)(first);
    await expect(createOpenArticle(openUrl)(second)).resolves.toBe('opened');

    opening.resolve(true);
    await expect(pending).resolves.toBe('opened');
  });
});
