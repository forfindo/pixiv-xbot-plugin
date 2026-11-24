export interface RequestOptions {
  cookie: string;
  proxy: string;
}

export interface PixivConfig extends RequestOptions {
  cacheDir: string;
}
