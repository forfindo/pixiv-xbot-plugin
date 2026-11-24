import { request as httpsRequest } from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { BASE, IMAGE_TIMEOUT, TIMEOUT, USER_AGENT } from './constants.js';
import type { RawRequestOptions, RawResponse, RequestOptions } from '../types/index.js';

let cachedAgent: { proxy: string; agent: HttpsProxyAgent<string> } | null = null;

function getAgent(proxy: string): HttpsProxyAgent<string> {
  if (!cachedAgent || cachedAgent.proxy !== proxy) {
    cachedAgent = { proxy, agent: new HttpsProxyAgent(proxy) };
  }
  return cachedAgent.agent;
}

function decodeBody(buffer: Buffer, encoding: string): Buffer {
  switch (encoding) {
    case 'gzip':
      return gunzipSync(buffer);
    case 'deflate':
      return inflateSync(buffer);
    case 'br':
      return brotliDecompressSync(buffer);
    default:
      return buffer;
  }
}

export function requestRaw(path: string, options: RawRequestOptions): Promise<RawResponse> {
  const url = new URL(path, BASE);
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Referer: options.referer ?? `${BASE}/`,
    Accept: options.accept ?? 'application/json',
    'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
  };
  if (options.cookie) headers.Cookie = options.cookie;

  return new Promise<RawResponse>((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: 'GET',
        agent: getAgent(options.proxy),
        headers,
        timeout: options.timeout ?? TIMEOUT,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          try {
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              throw new Error(`Pixiv request failed: HTTP ${status} (${path})`);
            }
            const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
            resolve({
              buffer: decodeBody(Buffer.concat(chunks), encoding),
              contentType: String(res.headers['content-type'] || ''),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`Pixiv request timeout: ${path}`)));
    req.on('error', reject);
    req.end();
  });
}

export async function requestJson<T>(path: string, options: RequestOptions): Promise<T> {
  const { buffer } = await requestRaw(path, options);
  const json = JSON.parse(buffer.toString('utf8')) as {
    error?: boolean;
    message?: string;
    body?: T;
  };
  if (json.error) {
    throw new Error(`Pixiv API error: ${json.message || 'unknown'} (${path})`);
  }
  return json.body as T;
}

export function downloadImage(
  imageUrl: string,
  pageUrl: string,
  options: RequestOptions,
): Promise<RawResponse> {
  return requestRaw(imageUrl, {
    ...options,
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    referer: pageUrl,
    timeout: IMAGE_TIMEOUT,
  });
}
