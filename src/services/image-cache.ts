import { randomInt } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { downloadImage, requestJson } from '../infra/http.js';
import type { IllustPage, PixivConfig, PixivImage } from '../types/index.js';
import * as console from "node:console";

const KNOWN_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];

function imageCacheKey(id: string, index: number): string {
  return `${id}_${index}`;
}

async function findCachedImage(cacheDir: string, key: string): Promise<string | null> {
  for (const extension of KNOWN_EXTENSIONS) {
    const file = join(cacheDir, `${key}${extension}`);
    try {
      await access(file);
      return file;
    } catch {
      // 继续尝试下一个扩展名
    }
  }
  return null;
}

async function fetchIllustPages(id: string, config: PixivConfig): Promise<IllustPage[]> {
  const pages = await requestJson<IllustPage[]>(
    `/ajax/illust/${encodeURIComponent(id)}/pages?lang=zh`,
    config,
  );
  return Array.isArray(pages) ? pages : [];
}

function resolveExtension(imageUrl: string, contentType: string): string {
  const fromUrl = extname(new URL(imageUrl).pathname).toLowerCase();
  if (KNOWN_EXTENSIONS.includes(fromUrl)) return fromUrl;

  const type = contentType.split(';', 1)[0]?.trim().toLowerCase();
  switch (type) {
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/avif':
      return '.avif';
    default:
      return '.jpg';
  }
}

export async function ensureLocalImage(
  image: PixivImage,
  config: PixivConfig,
): Promise<string> {
  const pageCount = image.pageCount && image.pageCount > 0 ? image.pageCount : undefined;
  let index = pageCount ? randomInt(0, pageCount) : 0;

  if (pageCount) {
    const cached = await findCachedImage(config.cacheDir, imageCacheKey(image.id, index));
    if (cached) return cached;
  }

  const pages = await fetchIllustPages(image.id, config);
  if (pages.length === 0) {
    throw new Error(`作品 ${image.id} 没有可用图片`);
  }

  if (!pageCount) {
    index = randomInt(0, pages.length);
    const cached = await findCachedImage(config.cacheDir, imageCacheKey(image.id, index));
    if (cached) return cached;
  }

  let page = pages[index];
  if (!page) {
    index = randomInt(0, pages.length);
    page = pages[index];
    const cached = await findCachedImage(config.cacheDir, imageCacheKey(image.id, index));
    if (cached) return cached;
  }
  if (!page) {
    throw new Error(`作品 ${image.id} 的第 ${index} 页不存在`);
  }

  const imageUrl = page.urls?.original || page.urls?.regular || page.urls?.thumb;
  if (!imageUrl) {
    throw new Error(`作品 ${image.id} 的第 ${index} 页没有可用图片`);
  }

  const { buffer, contentType } = await downloadImage(imageUrl, image.pageUrl, config);
  await mkdir(config.cacheDir, { recursive: true });

  const key = imageCacheKey(image.id, index);
  const file = join(config.cacheDir, `${key}${resolveExtension(imageUrl, contentType)}`);
  await writeFile(file, buffer);
  return file;
}
