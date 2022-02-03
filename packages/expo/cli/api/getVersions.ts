import { EXPO_BETA } from '../utils/env';
import { CommandError } from '../utils/errors';
import { pickBy } from '../utils/obj';
import { createCachedFetch } from './rest/client';

export type SDKVersion = {
  iosVersion?: string;
  releaseNoteUrl?: string;
  iosClientUrl?: string;
  iosClientVersion?: string;
  androidClientUrl?: string;
  androidClientVersion?: string;
  relatedPackages?: { [name: string]: string };
  beta?: boolean;
};

export type SDKVersions = Record<string, SDKVersion>;

type Versions = {
  androidUrl: string;
  androidVersion: string;
  iosUrl: string;
  iosVersion: string;
  sdkVersions: SDKVersions;
};

/** Get versions from remote endpoint. */
export async function getVersionsAsync(): Promise<Versions> {
  // Reconstruct the cached fetch since caching could be disabled.
  const fetch = createCachedFetch({
    cacheDirectory: 'versions-cache',
    // We'll use a 1 week cache for versions so older versions get flushed out eventually.
    ttl: 1000 * 60 * 60 * 24 * 7,
  });

  const results = await fetch('/versions/latest');
  if (!results.ok) {
    throw new CommandError(
      'API',
      `Unexpected response when fetching version info from Expo servers: ${results.statusText}.`
    );
  }
  const json = await results.json();
  return json.data;
}

// NOTE(brentvatne): it is possible for an unreleased version to be published to
// the versions endpoint, but in some cases we only want to list out released
// versions
export async function getReleasedVersionsAsync(): Promise<SDKVersions> {
  const { sdkVersions } = await getVersionsAsync();
  return pickBy(
    sdkVersions,
    (data, _sdkVersionString) => !!data.releaseNoteUrl || (EXPO_BETA && data.beta)
  );
}
