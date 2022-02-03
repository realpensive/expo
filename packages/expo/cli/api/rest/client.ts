import { getExpoHomeDirectory } from '@expo/config/build/getUserState';
import { JSONValue } from '@expo/json-file';
import fetchInstance, { FetchError } from 'node-fetch';
import path from 'path';
import { URL } from 'url';

import { EXPO_BETA, EXPO_NO_CACHE } from '../../utils/env';
import { isUrl } from '../../utils/url';
import { getExpoApiBaseUrl } from '../endpoint';
import { getAccessToken, getSessionSecret } from '../user/sessionStorage';
import { FileSystemCache } from './cache/FileSystemCache';
import { wrapFetchWithCache } from './cache/wrapFetchWithCache';
import { FetchLike } from './client.types';

export class ApiV2Error extends Error {
  readonly name = 'ApiV2Error';
  readonly expoApiV2ErrorCode: string;
  readonly expoApiV2ErrorDetails?: JSONValue;
  readonly expoApiV2ErrorServerStack?: string;
  readonly expoApiV2ErrorMetadata?: object;

  constructor(response: {
    message: string;
    code: string;
    stack?: string;
    details?: JSONValue;
    metadata?: object;
  }) {
    super(response.message);
    this.expoApiV2ErrorCode = response.code;
    this.expoApiV2ErrorDetails = response.details;
    this.expoApiV2ErrorServerStack = response.stack;
    this.expoApiV2ErrorMetadata = response.metadata;
  }
}

export class UnexpectedServerError extends Error {
  readonly name = 'UnexpectedServerError';
}

export function wrapFetchWithCredentials(fetchFunction: FetchLike): FetchLike {
  return async function fetchWithCredentials(url, options = {}) {
    if (Array.isArray(options.headers)) {
      throw new Error('request headers must be in object form');
    }

    const resolvedHeaders = options.headers || ({} as any);

    const token = getAccessToken();
    if (token) {
      resolvedHeaders.authorization = `Bearer ${token}`;
    } else {
      const sessionSecret = getSessionSecret();
      if (sessionSecret) {
        resolvedHeaders['expo-session'] = sessionSecret;
      }
    }

    const results = await fetchFunction(url, {
      ...options,
      headers: resolvedHeaders,
    });

    if (results.status >= 400 && results.status < 500) {
      const body = await results.text();
      try {
        const data = JSON.parse(body);
        if (data?.errors?.length) {
          throw new ApiV2Error(data.errors[0]);
        }
      } catch (error) {
        // Server returned non-json response.
        if (error.message.match(/in JSON at position/)) {
          throw new UnexpectedServerError(body);
        }
        throw error;
      }
    }
    return results;
  };
}

function wrapFetchWithPrefixUrl(fetch: FetchLike, baseUrl: string): FetchLike {
  return (url, init) => {
    if (typeof url === 'string') {
      let parsed: URL;
      if (isUrl(url)) {
        parsed = new URL(url);
      } else {
        parsed = new URL(baseUrl + url);
      }
      if (init.searchParams) {
        parsed.search = init.searchParams.toString();
      }
      return fetch(parsed.toString(), init);
    }
    return fetch(url, init);
  };
}

const fetchWithBaseUrl = wrapFetchWithPrefixUrl(fetchInstance, getExpoApiBaseUrl() + '/v2');

const fetchWithCredentials = wrapFetchWithCredentials(fetchWithBaseUrl);

export function createCachedFetch({
  fetch,
  cacheDirectory,
  ttl,
}: {
  fetch?: FetchLike;
  cacheDirectory: string;
  ttl?: number;
}): FetchLike {
  // Disable all caching in EXPO_BETA.
  if (EXPO_BETA || EXPO_NO_CACHE()) {
    return fetch ?? fetchWithCredentials;
  }

  return wrapFetchWithCache(
    fetch ?? fetchWithCredentials,
    new FileSystemCache({
      cacheDirectory: path.join(getExpoHomeDirectory(), cacheDirectory),
      ttl,
    })
  );
}

export const fetch = fetchWithCredentials;
