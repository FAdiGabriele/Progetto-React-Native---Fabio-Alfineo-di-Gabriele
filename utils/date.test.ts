import { formatDateTime, formatTime, isToday, parseIsoDate } from '@/utils/date';

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

describe('time zone of the test run', () => {
  it('is fixed to Europe/Rome by the Jest global setup', () => {
    expect(process.env.TZ).toBe('Europe/Rome');
    expect(new Date('2026-09-24T12:30:00Z').getTimezoneOffset()).toBe(-120);
    expect(new Date('2026-01-05T08:05:00Z').getTimezoneOffset()).toBe(-60);
  });
});

describe('formatDateTime', () => {
  it('formats in Italian as day, abbreviated month, year and 24-hour time', () => {
    expect(formatDateTime(new Date('2026-09-24T12:30:00Z'), 'it-IT')).toBe('24 set 2026, 14:30');
  });

  it('formats in US English as abbreviated month, day, year and 12-hour time', () => {
    expect(formatDateTime(new Date('2026-09-24T12:30:00Z'), 'en-US')).toBe('Sep 24, 2026, 2:30 PM');
  });

  it('uses two-digit hours in Italian and no padding in English', () => {
    const winterMorning = new Date('2026-01-05T08:05:00Z');
    expect(formatDateTime(winterMorning, 'it-IT')).toBe('5 gen 2026, 09:05');
    expect(formatDateTime(winterMorning, 'en-US')).toBe('Jan 5, 2026, 9:05 AM');
  });

  it('shows the local day when it differs from the UTC day', () => {
    const lateEvening = new Date('2026-09-23T22:00:00Z');
    expect(formatDateTime(lateEvening, 'it-IT')).toBe('24 set 2026, 00:00');
    expect(formatDateTime(lateEvening, 'en-US')).toBe('Sep 24, 2026, 12:00 AM');

    const newYear = new Date('2026-12-31T23:30:00Z');
    expect(formatDateTime(newYear, 'it-IT')).toBe('1 gen 2027, 00:30');
    expect(formatDateTime(newYear, 'en-US')).toBe('Jan 1, 2027, 12:30 AM');
  });

  it('formats the dates parsed from the API in both locales', () => {
    const date = parseIsoDate('2026-09-23T16:45:12Z');
    expect(formatDateTime(date, 'it-IT')).toBe('23 set 2026, 18:45');
    expect(formatDateTime(date, 'en-US')).toBe('Sep 23, 2026, 6:45 PM');
  });

  it('returns undefined for a missing or invalid date', () => {
    expect(formatDateTime(undefined, 'it-IT')).toBe(undefined);
    expect(formatDateTime(new Date('not a date'), 'it-IT')).toBe(undefined);
    expect(formatDateTime(new Date(Number.NaN), 'en-US')).toBe(undefined);
  });
});

describe('formatTime', () => {
  it('formats hours and minutes in Italian with two-digit hours', () => {
    expect(formatTime(new Date('2026-09-24T12:30:00Z'), 'it-IT')).toBe('14:30');
    expect(formatTime(new Date('2026-01-05T08:05:00Z'), 'it-IT')).toBe('09:05');
    expect(formatTime(new Date('2026-09-23T22:00:00Z'), 'it-IT')).toBe('00:00');
  });

  it('formats hours and minutes in US English with AM or PM and no padding', () => {
    expect(formatTime(new Date('2026-09-24T12:30:00Z'), 'en-US')).toBe('2:30 PM');
    expect(formatTime(new Date('2026-01-05T08:05:00Z'), 'en-US')).toBe('9:05 AM');
    expect(formatTime(new Date('2026-09-23T22:00:00Z'), 'en-US')).toBe('12:00 AM');
    expect(formatTime(new Date('2026-09-24T10:00:00Z'), 'en-US')).toBe('12:00 PM');
  });

  it('shows only the time, without the date, in the device time zone', () => {
    const date = parseIsoDate('2026-09-23T16:45:12Z');
    expect(formatTime(date, 'it-IT')).toBe('18:45');
    expect(formatTime(date, 'en-US')).toBe('6:45 PM');
    expect(formatDateTime(date, 'it-IT')).toContain(formatTime(date, 'it-IT') as string);
    expect(formatDateTime(date, 'en-US')).toContain(formatTime(date, 'en-US') as string);
  });

  it('returns undefined for a missing or invalid date', () => {
    expect(formatTime(undefined, 'it-IT')).toBe(undefined);
    expect(formatTime(new Date('not a date'), 'it-IT')).toBe(undefined);
    expect(formatTime(new Date(Number.NaN), 'en-US')).toBe(undefined);
  });
});

describe('isToday', () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  it('is true for every instant of the current local day', () => {
    expect(isToday(now)).toBe(true);
    expect(isToday(startOfToday)).toBe(true);
    expect(isToday(endOfToday)).toBe(true);
  });

  it('is false for yesterday, tomorrow and other days', () => {
    expect(isToday(new Date(startOfToday.getTime() - 1))).toBe(false);
    expect(isToday(startOfTomorrow)).toBe(false);
    expect(isToday(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 12))).toBe(false);
    expect(isToday(new Date('2000-01-01T12:00:00Z'))).toBe(false);
  });

  it('compares the local day of Europe/Rome, not the UTC day', () => {
    // Local midnight in Rome is still the previous day in UTC.
    expect(startOfToday.getUTCDate()).not.toBe(startOfToday.getDate());
    expect(isToday(startOfToday)).toBe(true);
    const lastUtcInstantOfYesterday = new Date(startOfToday.getTime() - 1);
    expect(isToday(lastUtcInstantOfYesterday)).toBe(false);
  });

  it('is false for an invalid date', () => {
    expect(isToday(new Date('not a date'))).toBe(false);
    expect(isToday(new Date(Number.NaN))).toBe(false);
  });
});
