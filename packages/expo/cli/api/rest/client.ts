import { getExpoHomeDirectory } from '@expo/config/build/getUserState';
import { JSONValue } from '@expo/json-file';
import fetchInstance from 'node-fetch';
import path from 'path';

import { EXPO_BETA, EXPO_NO_CACHE } from '../../utils/env';
import { getExpoApiBaseUrl } from '../endpoint';
import { getAccessToken, getSessionSecret } from '../user/sessionStorage';
import { FileSystemCache } from './cache/FileSystemCache';
import { wrapFetchWithCache } from './cache/wrapFetchWithCache';
import { FetchLike } from './client.types';
import { wrapFetchWithPrefixUrl } from './wrapFetchWithPrefixUrl';

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

/**
 * An Expo server error that didn't return the expected error JSON information.
 * The only 'expected' place for this is in testing, all other cases are bugs with the server.
 */
export class UnexpectedServerError extends Error {
  readonly name = 'UnexpectedServerError';
}

/**
 * @returns a `fetch` function that will inject user authentication information and handle errors from the Expo API.
 */
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

const fetchWithBaseUrl = wrapFetchWithPrefixUrl(fetchInstance, getExpoApiBaseUrl() + '/v2');

const fetchWithCredentials = wrapFetchWithCredentials(fetchWithBaseUrl);

/**
 * Create an instance of the fully qualified fetch command (auto authentication and api) but with caching in the '~/.expo' directory.
 * Caching is disabled automatically if the EXPO_NO_CACHE or EXPO_BETA environment variables are enabled.
 */
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

/** Instance of fetch with automatic base URL pointing to the Expo API, user credential injection, and API error handling. Caching not included.  */
export const fetchAsync = wrapFetchWithCredentials(fetchWithBaseUrl);
