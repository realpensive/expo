import { FetchLike } from './client.types';

export function wrapFetchWithProgress(fetch: FetchLike): FetchLike {
  return async (url, init) => {
    const res = await fetch(url, init);
    if (res.ok && init?.onProgress) {
      const totalDownloadSize = res.headers.get('Content-Length');
      const total = Number(totalDownloadSize);

      let length: number = 0;

      res.body.on('data', (chunk) => {
        length += chunk.length;
        onProgress();
      });

      res.body.on('end', () => {
        onProgress();
      });

      const onProgress = () => {
        const progress = length / total;

        init.onProgress({
          progress,
          total,
          loaded: length,
        });
      };
    }
    return res;
  };
}
