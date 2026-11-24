import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PixivConfig } from '../types/index.js';

function cookieFile(config: PixivConfig): string {
  return join(config.cacheDir, 'cookie.txt');
}

export async function loadCookie(config: PixivConfig): Promise<void> {
  try {
    const value = await readFile(cookieFile(config), 'utf8');
    const cookie = value.replace(/^\uFEFF/, '').trim();
    if (cookie) config.cookie = cookie;
  } catch {
    // 文件不存在或不可读时保留默认配置
  }
}

export async function saveCookie(config: PixivConfig, cookie: string): Promise<void> {
  const file = cookieFile(config);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, cookie, { encoding: 'utf8', mode: 0o600 });
  config.cookie = cookie;
}

export async function clearCookie(config: PixivConfig): Promise<void> {
  await rm(cookieFile(config), { force: true });
  config.cookie = '';
}
