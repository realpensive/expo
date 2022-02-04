import dns from 'dns';
import { URL, parse } from 'url';

/** Check if a server is available based on the URL. */
export function isUrlAvailableAsync(url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    dns.lookup(url, (err) => {
      resolve(!err);
    });
  });
}

/** A light-weight test to determine if a string starts with `http://` or `https://`. */
export function isUrl(str: string) {
  return !!/^https?:\/\//.test(str);
}

/** Check if a request to the given URL is `ok` (status 200). */
export async function isUrlOk(url: string): Promise<boolean> {
  const fetch = await (await import('node-fetch')).default;
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch {
    return false;
  }
}

/** A heavy-weight test to determine if a string is a valid URL, can optional ensure certain protocols (like `https` or `exp`) are adhered to. */
export function validateUrl(
  urlString: string,
  {
    protocols,
    requireProtocol,
  }: {
    /** Set of allowed protocols for the string to adhere to. @example ['exp', 'https'] */
    protocols?: string[];
    /** Ensure the URL has a protocol component (prefix before `://`). */
    requireProtocol?: boolean;
  }
) {
  try {
    // eslint-disable-next-line
    new URL(urlString);
    const parsed = parse(urlString);
    if (!parsed.protocol && !requireProtocol) {
      return true;
    }
    return protocols
      ? parsed.protocol
        ? protocols.map((x) => `${x.toLowerCase()}:`).includes(parsed.protocol)
        : false
      : true;
  } catch (err) {
    return false;
  }
}
