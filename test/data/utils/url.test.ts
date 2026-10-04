import { getUrlDomain, isHttpUrl } from '@/data/utils/url';

describe('isHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(isHttpUrl('https://www.ansa.it/sito/notizie/politica.html')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com:8080/path?query=1#fragment')).toBe(true);
    expect(isHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isHttpUrl('  https://example.com/article  ')).toBe(true);
  });

  it('rejects other schemes', () => {
    expect(isHttpUrl('ftp://example.com/file')).toBe(false);
    expect(isHttpUrl('mailto:news@example.com')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('file:///C:/news.html')).toBe(false);
  });

  it('rejects relative paths, bare hosts and malformed values', () => {
    expect(isHttpUrl('/sito/notizie/politica.html')).toBe(false);
    expect(isHttpUrl('www.ansa.it/sito')).toBe(false);
    expect(isHttpUrl('https://')).toBe(false);
    expect(isHttpUrl('https:// example.com')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('rejects missing and empty values', () => {
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('   ')).toBe(false);
  });
});

describe('getUrlDomain', () => {
  it('returns the host without the leading "www."', () => {
    expect(getUrlDomain('https://www.ansa.it/sito/notizie/politica.html')).toBe('ansa.it');
    expect(getUrlDomain('https://www.ilsole24ore.com/art/giorgetti-AJQ6dXMB')).toBe('ilsole24ore.com');
  });

  it('keeps hosts that do not start with "www."', () => {
    expect(getUrlDomain('https://example.com')).toBe('example.com');
    expect(getUrlDomain('https://news.example.co.uk/story')).toBe('news.example.co.uk');
    expect(getUrlDomain('https://www2.example.com')).toBe('www2.example.com');
  });

  it('lowercases the host and drops port, path, query and fragment', () => {
    expect(getUrlDomain('HTTPS://WWW.Repubblica.IT/Politica?ref=1#top')).toBe('repubblica.it');
    expect(getUrlDomain('http://Example.com:8080/path')).toBe('example.com');
  });

  it('ignores surrounding whitespace', () => {
    expect(getUrlDomain('  https://www.ansa.it/  ')).toBe('ansa.it');
  });

  it('returns undefined for values that are not http URLs', () => {
    expect(getUrlDomain('ftp://www.example.com/file')).toBe(undefined);
    expect(getUrlDomain('www.example.com')).toBe(undefined);
    expect(getUrlDomain('https://')).toBe(undefined);
    expect(getUrlDomain('not a url')).toBe(undefined);
    expect(getUrlDomain('')).toBe(undefined);
    expect(getUrlDomain(null)).toBe(undefined);
    expect(getUrlDomain(undefined)).toBe(undefined);
  });
});
