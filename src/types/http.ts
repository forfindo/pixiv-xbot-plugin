import type { RequestOptions } from './config.js';

export interface RawRequestOptions extends RequestOptions {
  accept?: string;
  referer?: string;
  timeout?: number;
}

export interface RawResponse {
  buffer: Buffer;
  contentType: string;
}
