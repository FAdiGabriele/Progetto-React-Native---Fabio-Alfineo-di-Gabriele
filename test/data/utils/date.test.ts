import { parseIsoDate } from '@/data/utils/date';

const NOON_UTC = Date.UTC(2026, 8, 24, 12, 30);

describe('parseIsoDate', () => {
  it('parses UTC date-times with optional seconds and fractions', () => {
    expect(parseIsoDate('2026-09-24T12:30:00Z')?.getTime()).toBe(NOON_UTC);
    expect(parseIsoDate('2026-09-24T12:30Z')?.getTime()).toBe(NOON_UTC);
    expect(parseIsoDate('2026-09-24T12:30:00.123Z')?.getTime()).toBe(NOON_UTC + 123);
    expect(parseIsoDate('2026-09-24T12:30:00.1234567Z')?.getTime()).toBe(NOON_UTC + 123);
  });

  it('parses date-times with a numeric offset', () => {
    expect(parseIsoDate('2026-09-24T14:30:00+02:00')?.getTime()).toBe(NOON_UTC);
    expect(parseIsoDate('2026-09-24T07:30:00-05:00')?.getTime()).toBe(NOON_UTC);
  });

  it('returns a Date instance and ignores surrounding whitespace', () => {
    const date = parseIsoDate('  2026-09-24T12:30:00Z  ');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getTime()).toBe(NOON_UTC);
  });

  it('returns undefined for missing, empty and non-string values', () => {
    expect(parseIsoDate(undefined)).toBe(undefined);
    expect(parseIsoDate(null)).toBe(undefined);
    expect(parseIsoDate('')).toBe(undefined);
    expect(parseIsoDate('   ')).toBe(undefined);
    expect(parseIsoDate(NOON_UTC as unknown as string)).toBe(undefined);
  });

  it('returns undefined for forms other than an ISO 8601 date-time with zone', () => {
    expect(parseIsoDate('2026-09-24')).toBe(undefined);
    expect(parseIsoDate('2026-09-24T12:30:00')).toBe(undefined);
    expect(parseIsoDate('2026-09-24 12:30:00Z')).toBe(undefined);
    expect(parseIsoDate('2026-09-24T12:30:00 Z')).toBe(undefined);
    expect(parseIsoDate('2026-09-24T12Z')).toBe(undefined);
    expect(parseIsoDate('24/09/2026 12:30')).toBe(undefined);
    expect(parseIsoDate('Thu, 24 Sep 2026 12:30:00 GMT')).toBe(undefined);
    expect(parseIsoDate('1790253000000')).toBe(undefined);
    expect(parseIsoDate('yesterday')).toBe(undefined);
  });

  it('returns undefined for well-formed strings that are not valid dates', () => {
    expect(parseIsoDate('2026-13-01T00:00:00Z')).toBe(undefined);
    expect(parseIsoDate('2026-00-10T00:00:00Z')).toBe(undefined);
    expect(parseIsoDate('2026-09-24T25:00:00Z')).toBe(undefined);
    expect(parseIsoDate('2026-09-24T12:60:00Z')).toBe(undefined);
  });
});
