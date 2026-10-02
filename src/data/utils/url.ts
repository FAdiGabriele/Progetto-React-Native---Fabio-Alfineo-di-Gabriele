function parseHttpUrl(value: string | null | undefined): URL | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  return isHttp && url.hostname !== '' ? url : undefined;
}

/** Whether the value is an absolute http or https URL. */
export function isHttpUrl(value: string | null | undefined): boolean {
  return parseHttpUrl(value) !== undefined;
}

/**
 * Host of an http or https URL, in lowercase and without a leading "www.",
 * for example "ansa.it" from "https://www.ansa.it/sito/notizie/politica.html";
 * undefined when the value is not such a URL.
 */
export function getUrlDomain(value: string | null | undefined): string | undefined {
  const url = parseHttpUrl(value);
  return url ? url.hostname.toLowerCase().replace(/^www\./, '') : undefined;
}
