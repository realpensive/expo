import dns from 'dns';
import fetch from 'node-fetch';
import { URL, parse } from 'url';

export function isUrlAvailableAsync(url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    dns.lookup(url, (err) => {
      resolve(!err);
    });
  });
}

export function isUrl(str: string) {
  return !!/^https?:\/\//.test(str);
}

export async function isUrlOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch {
    return false;
  }
}

export function validateUrl(
  urlString: string,
  { protocols, requireProtocol }: { protocols?: string[]; requireProtocol?: boolean }
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
