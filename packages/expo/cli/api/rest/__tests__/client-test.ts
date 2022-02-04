import assert from 'assert';
import nock from 'nock';
import { FetchError } from 'node-fetch';
import { URLSearchParams } from 'url';

import { getExpoApiBaseUrl } from '../../endpoint';
import { getAccessToken, getSessionSecret } from '../../user/sessionStorage';
import { ApiV2Error, fetchAsync } from '../client';

jest.mock('../../user/sessionStorage');
const asMock = (fn: any): jest.Mock => fn as jest.Mock;

beforeEach(() => {
  asMock(getAccessToken).mockReset();
  asMock(getSessionSecret).mockReset();
});

it('converts Expo APIv2 error to ApiV2Error', async () => {
  const scope = nock(getExpoApiBaseUrl())
    .post('/v2/test')
    .reply(400, {
      errors: [
        {
          message: 'hellomessage',
          code: 'TEST_CODE',
          stack: 'line 1: hello',
          details: { who: 'world' },
          metadata: { an: 'object' },
        },
      ],
    });

  expect.assertions(6);

  try {
    await fetchAsync('/test', {
      method: 'POST',
    });
  } catch (error: any) {
    assert(error instanceof ApiV2Error);

    expect(error.message).toEqual('hellomessage');
    expect(error.expoApiV2ErrorCode).toEqual('TEST_CODE');
    expect(error.expoApiV2ErrorDetails).toEqual({ who: 'world' });
    expect(error.expoApiV2ErrorMetadata).toEqual({ an: 'object' });
    expect(error.expoApiV2ErrorServerStack).toEqual('line 1: hello');
  }
  expect(scope.isDone()).toBe(true);
});

it('converts Expo APIv2 error to ApiV2Error (invalid password)', async () => {
  const scope = nock(getExpoApiBaseUrl())
    .post('/v2/test')
    .reply(401, {
      errors: [
        {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid username/password. Please try again.',
          isTransient: false,
        },
      ],
    });

  expect.assertions(3);

  try {
    await fetchAsync('/test', {
      method: 'POST',
    });
  } catch (error: any) {
    assert(error instanceof ApiV2Error);

    expect(error.message).toEqual('Invalid username/password. Please try again.');
    expect(error.expoApiV2ErrorCode).toEqual('AUTHENTICATION_ERROR');
  }
  expect(scope.isDone()).toBe(true);
});

it('does not convert non-APIv2 error to ApiV2Error', async () => {
  nock(getExpoApiBaseUrl()).post('/v2/test').reply(500, 'Something went wrong');

  expect.assertions(2);

  try {
    await fetchAsync('test', {
      method: 'POST',
    });
  } catch (error: any) {
    expect(error).toBeInstanceOf(FetchError);
    expect(error).not.toBeInstanceOf(ApiV2Error);
  }
});

it('makes a get request', async () => {
  nock(getExpoApiBaseUrl()).get('/v2/get-me?foo=bar').reply(200, 'Hello World');
  const res = await fetchAsync('/get-me', {
    method: 'GET',
    // Ensure our custom support for URLSearchParams works...
    searchParams: new URLSearchParams({
      foo: 'bar',
    }),
  });
  expect(res.status).toEqual(200);
  expect(await res.text()).toEqual('Hello World');
});

// This test ensures that absolute URLs are allowed with the abstraction.
it('makes a request using an absolute URL', async () => {
  nock('http://example').get('/get-me?foo=bar').reply(200, 'Hello World');
  const res = await fetchAsync('http://example/get-me', {
    searchParams: new URLSearchParams({
      foo: 'bar',
    }),
  });
  expect(res.status).toEqual(200);
  expect(await res.text()).toEqual('Hello World');
});

it('makes an authenticated request with access token', async () => {
  asMock(getAccessToken).mockReturnValue('my-access-token');

  nock(getExpoApiBaseUrl())
    .matchHeader('authorization', (val) => val.length === 1 && val[0] === 'Bearer my-access-token')
    .get('/v2/get-me')
    .reply(200, 'Hello World');
  const res = await fetchAsync('/get-me', {
    method: 'GET',
  });
  expect(res.status).toEqual(200);
});

it('makes an authenticated request with session secret', async () => {
  asMock(getSessionSecret).mockReturnValue('my-secret-token');

  nock(getExpoApiBaseUrl())
    .matchHeader('expo-session', (val) => val.length === 1 && val[0] === 'my-secret-token')
    .get('/v2/get-me')
    .reply(200, 'Hello World');
  const res = await fetchAsync('/get-me', {
    method: 'GET',
  });
  expect(res.status).toEqual(200);
});

it('only uses access token when both authentication methods are available', async () => {
  asMock(getAccessToken).mockReturnValue('my-access-token');
  asMock(getSessionSecret).mockReturnValue('my-secret-token');

  nock(getExpoApiBaseUrl())
    .matchHeader('authorization', (val) => val.length === 1 && val[0] === 'Bearer my-access-token')
    .matchHeader('expo-session', (val) => !val)
    .get('/v2/get-me')
    .reply(200, 'Hello World');
  const res = await fetchAsync('/get-me', {
    method: 'GET',
  });
  expect(res.status).toEqual(200);
});
