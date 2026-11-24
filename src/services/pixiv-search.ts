import { randomInt } from 'node:crypto';
import { BASE } from '../infra/constants.js';
import { requestJson } from '../infra/http.js';
import { searchPageCache } from './search-page-cache.js';
import type { PixivImage, SearchBody, SearchOptions } from '../types/index.js';

function normalizeLastPage(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value as number)) : 1;
}

export async function searchRandomPixivImage(
  keyword: string,
  options: SearchOptions,
): Promise<PixivImage> {
  const {
    mode = 'safe',
    type = 'all',
    sMode = 's_tag',
    excludeAI = true,
    excludeR18 = true,
    lang = 'zh',
    cookie,
    proxy,
  } = options;

  const word = keyword.trim();
  if (!word) throw new TypeError('关键词不能为空');

  const searchPath = (page: number) => {
    const query = new URLSearchParams({
      word,
      order: 'date_d',
      mode,
      s_mode: sMode,
      type,
      lang,
      p: String(page),
    });
    return `/ajax/search/artworks/${encodeURIComponent(word)}?${query.toString()}`;
  };

  const cachedLastPage = searchPageCache.get(word);
  let page = cachedLastPage ? randomInt(1, cachedLastPage + 1) : 1;

  let body = await requestJson<SearchBody>(searchPath(page), { cookie, proxy });
  let works = body?.illustManga?.data;
  let lastPage = normalizeLastPage(body?.illustManga?.lastPage);

  if (cachedLastPage !== undefined && (!Array.isArray(works) || works.length === 0)) {
    searchPageCache.delete(word);
    page = 1;
    body = await requestJson<SearchBody>(searchPath(page), { cookie, proxy });
    works = body?.illustManga?.data;
    lastPage = normalizeLastPage(body?.illustManga?.lastPage);
  }

  if (!Array.isArray(works) || works.length === 0) {
    throw new Error(`没有找到关键词「${word}」相关的作品`);
  }

  searchPageCache.set(word, lastPage);

  const candidates = works.filter(
    (item) =>
      Boolean(item?.id && item?.url) &&
      !item.isMasked &&
      (item.pageCount === undefined || item.pageCount > 0) &&
      (!excludeAI || item.aiType !== 2) &&
      (!excludeR18 || (item.xRestrict || 0) === 0),
  );
  if (candidates.length === 0) {
    throw new Error(`关键词「${word}」没有可用作品`);
  }

  const item = candidates[randomInt(candidates.length)];
  if (!item) {
    throw new Error(`关键词「${word}」没有可用作品`);
  }

  return {
    id: item.id,
    title: item.title,
    author: item.userName,
    authorId: item.userId,
    pageUrl: `${BASE}/artworks/${item.id}`,
    width: item.width,
    height: item.height,
    pageCount: item.pageCount,
  };
}
