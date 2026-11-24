import type { RequestOptions } from './config.js';

export type PixivSize = 'original' | 'regular' | 'thumb';
export type PixivMode = 'all' | 'safe' | 'r18';
export type PixivType = 'all' | 'illust' | 'manga' | 'ugoira';
export type PixivSearchMode = 's_tag' | 's_tag_full' | 's_tc';

export interface PixivManifest {
  depsOn: Record<string, never>;
}

export interface SearchOptions extends RequestOptions {
  mode?: PixivMode;
  type?: PixivType;
  sMode?: PixivSearchMode;
  excludeAI?: boolean;
  excludeR18?: boolean;
  lang?: string;
}

export interface PixivWork {
  id: string;
  title: string;
  userName: string;
  userId: string;
  url: string;
  width?: number;
  height?: number;
  pageCount?: number;
  isMasked?: boolean;
  aiType?: number;
  xRestrict?: number;
}

export interface SearchBody {
  illustManga?: {
    data?: PixivWork[];
    lastPage?: number;
  };
}

export interface IllustPage {
  urls?: Partial<Record<PixivSize, string>>;
  width?: number;
  height?: number;
}

export interface PixivImage {
  id: string;
  title: string;
  author: string;
  authorId: string;
  pageUrl: string;
  width?: number;
  height?: number;
  pageCount?: number;
}
