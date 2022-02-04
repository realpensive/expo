import { vol } from 'memfs';
import nock from 'nock';

import { getExpoApiBaseUrl } from '../../api/endpoint';
import { downloadAppAsync } from '../downloadAppAsync';
import { downloadExpoGoAsync } from '../downloadExpoGoAsync';
import { extractAsync } from '../tar';

const asMock = (fn: any): jest.Mock => fn;

jest.mock('fs');

jest.mock('progress', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    tick: jest.fn(),
    terminate: jest.fn(),
  })),
}));

jest.mock('tempy', () => ({
  //   __esModule: true,
  //   default: jest.fn(() => ({
  file: jest.fn(({ name }) => '/tmp/' + name),
  //   })),
}));

jest.mock(`../downloadAppAsync`, () => ({
  downloadAppAsync: jest.fn(),
}));

jest.mock(`../tar`, () => ({
  extractAsync: jest.fn(),
}));

describe(downloadExpoGoAsync, () => {
  beforeEach(() => {
    asMock(extractAsync).mockImplementationOnce(jest.fn());
    asMock(downloadAppAsync).mockImplementationOnce(
      jest.fn(jest.requireActual('../downloadAppAsync').downloadAppAsync)
    );
    vol.reset();
  });
  it('downloads the Expo Go app on iOS', async () => {
    vol.fromJSON({ tmp: '' }, '/tmp');
    const scope = nock(getExpoApiBaseUrl())
      .get('/v2/versions/latest')
      .reply(200, require('../../api/__tests__/fixtures/versions-latest.json'));
    const scopeClient = nock('https://dpq5q02fu5f55.cloudfront.net')
      .get('/Exponent-2.23.2.tar.gz')
      .reply(200, '...');

    await downloadExpoGoAsync('ios');

    const generatedOutput = '/home/.expo/ios-simulator-app-cache/Exponent-2.23.2.tar.app';

    // Endpoints were called
    expect(scope.isDone()).toBe(true);
    expect(scopeClient.isDone()).toBe(true);

    // Platform options were parsed
    expect(downloadAppAsync).toHaveBeenCalledWith({
      cacheDirectory: 'expo-go',
      extract: true,
      onProgress: expect.anything(),
      outputPath: generatedOutput,
      url: 'https://dpq5q02fu5f55.cloudfront.net/Exponent-2.23.2.tar.gz',
    });

    // File won't be written because we mock the tar extraction.
    // expect(vol.toJSON()[generatedOutput]).toBeDefined();

    // Did extract tar
    expect(extractAsync).toHaveBeenCalledWith('/tmp/Exponent-2.23.2.tar.app', generatedOutput);
  });

  it('downloads the Expo Go app on Android', async () => {
    vol.fromJSON({}, '');

    asMock(extractAsync).mockReset();

    const scope = nock(getExpoApiBaseUrl())
      .get('/v2/versions/latest')
      .reply(200, require('../../api/__tests__/fixtures/versions-latest.json'));
    const scopeClient = nock('https://d1ahtucjixef4r.cloudfront.net')
      .get('/Exponent-2.23.2.apk')
      .reply(200, '...');

    await downloadExpoGoAsync('android');

    const generatedOutput = '/home/.expo/android-apk-cache/Exponent-2.23.2.apk';

    // Endpoints were called
    expect(scope.isDone()).toBe(true);
    expect(scopeClient.isDone()).toBe(true);

    // Platform options were parsed
    expect(downloadAppAsync).toHaveBeenCalledWith({
      cacheDirectory: 'expo-go',
      extract: false,
      onProgress: expect.anything(),
      outputPath: generatedOutput,
      url: 'https://d1ahtucjixef4r.cloudfront.net/Exponent-2.23.2.apk',
    });

    expect(vol.toJSON()[generatedOutput]).toBeDefined();
    // Did not extract Android APK
    expect(extractAsync).toHaveBeenCalledTimes(0);
  });

  it('fails when the servers are down', async () => {
    vol.fromJSON({}, '');

    const scope = nock(getExpoApiBaseUrl())
      .get('/v2/versions/latest')
      .reply(200, require('../../api/__tests__/fixtures/versions-latest.json'));

    // Mock a server failure when fetching from cloudfront.
    const scopeClient = nock('https://d1ahtucjixef4r.cloudfront.net')
      .get('/Exponent-2.23.2.apk')
      .reply(500, 'something went wrong');

    await expect(downloadExpoGoAsync('android')).rejects.toThrow(
      /Unexpected response: Internal Server Error\. From url: https:\/\/d1ahtucjixef4r\.cloudfront\.net\/Exponent-2\.23\.2\.apk/
    );
    const generatedOutput = '/home/.expo/android-apk-cache/Exponent-2.23.2.apk';

    // Endpoints were called
    expect(scope.isDone()).toBe(true);
    expect(scopeClient.isDone()).toBe(true);

    // Platform options were parsed
    expect(downloadAppAsync).toHaveBeenCalled();

    // FS was not modified
    expect(vol.toJSON()[generatedOutput]).not.toBeDefined();
  });
});
