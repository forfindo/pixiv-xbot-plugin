import { randomInt } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: vi.fn() };
});

vi.mock('../../src/infra/http.js', () => ({
  requestJson: vi.fn(),
  downloadImage: vi.fn(),
  requestRaw: vi.fn(),
}));

import { pixivCommand } from '../../src/commands/pixiv.js';
import { downloadImage, requestJson } from '../../src/infra/http.js';
import { searchPageCache } from '../../src/services/search-page-cache.js';
import type { PixivConfig } from '../../src/types/index.js';

const command = pixivCommand[0]!;
const requestJsonMock = vi.mocked(requestJson);
const downloadImageMock = vi.mocked(downloadImage);
const randomIntMock = randomInt as unknown as Mock;

type ExecCtx = Parameters<typeof command.execute>[1];
type ExecArgs = Parameters<typeof command.execute>[2];

const searchBody = {
  illustManga: {
    data: [
      {
        id: '123',
        title: '测试标题',
        userName: '测试作者',
        userId: '9',
        url: 'https://i.pximg.net/c/240x480/img-master/img/123_p0_master1200.jpg',
        pageCount: 2,
      },
    ],
    lastPage: 1,
  },
};

const pagesBody = [
  {
    urls: {
      original: 'https://i.pximg.net/img-original/img/123_p0.png',
    },
  },
  {
    urls: {
      original: 'https://i.pximg.net/img-original/img/123_p1.png',
    },
  },
];

let dir: string;
let config: PixivConfig;

const createCtx = (): ExecCtx => ({ state: { pixivConfig: config } }) as unknown as ExecCtx;

function execute(keyword: string) {
  const value = keyword.trim();
  const args = {
    _: ['pixiv'],
    keyword: value ? value.split(/\s+/) : [],
  } as unknown as ExecArgs;
  return command.execute(`pixiv${value ? ` ${value}` : ''}`, createCtx(), args);
}

function searchPaths(): string[] {
  return requestJsonMock.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.startsWith('/ajax/search/artworks/'));
}

function pageOf(path: string): string | null {
  return new URL(path, 'https://www.pixiv.net').searchParams.get('p');
}

function useSearchBodyWithLastPage(lastPage: number): void {
  requestJsonMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/ajax/search/artworks/')) {
      return {
        illustManga: { data: searchBody.illustManga.data, lastPage },
      } as never;
    }
    if (path.startsWith('/ajax/illust/')) return pagesBody as never;
    throw new Error(`unexpected path: ${path}`);
  });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pixiv-cmd-'));
  config = {
    proxy: 'http://127.0.0.1:7890',
    cookie: 'session=token',
    cacheDir: dir,
  };

  searchPageCache.clear();
  requestJsonMock.mockReset();
  downloadImageMock.mockReset();
  randomIntMock.mockReset();
  randomIntMock.mockImplementation((min: number, max?: number) => {
    if (max === undefined) return 0;
    return Math.min(2, Math.max(min, max - 1));
  });
  requestJsonMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/ajax/search/artworks/')) return searchBody as never;
    if (path.startsWith('/ajax/illust/')) return pagesBody as never;
    throw new Error(`unexpected path: ${path}`);
  });
  downloadImageMock.mockResolvedValue({
    buffer: Buffer.from('image-bytes'),
    contentType: 'image/png',
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('pixivCommand.execute', () => {
  it('没有关键词时返回用法提示且不请求网络', async () => {
    const result = await execute('  ');

    expect(result?.content).toEqual([
      { type: 'text', text: '用法：pixiv <关键词>，例如 pixiv 原神' },
    ]);
    expect(requestJsonMock).not.toHaveBeenCalled();
    expect(downloadImageMock).not.toHaveBeenCalled();
  });

  it('搜索成功后随机页下载图片并按 ID + 索引缓存，返回本地路径', async () => {
    const result = await execute('雷米埃尔');

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.stringContaining('/ajax/search/artworks/'),
      { cookie: config.cookie, proxy: config.proxy },
    );
    expect(requestJsonMock).toHaveBeenCalledWith('/ajax/illust/123/pages?lang=zh', config);
    expect(searchPaths()).toHaveLength(1);
    expect(pageOf(searchPaths()[0] as string)).toBe('1');
    expect(downloadImageMock).toHaveBeenCalledWith(
      pagesBody[1]?.urls.original,
      'https://www.pixiv.net/artworks/123',
      config,
    );

    const imagePath = join(dir, '123_1.png');
    expect(await readFile(imagePath, 'utf8')).toBe('image-bytes');
    expect(result?.content).toEqual([
      {
        type: 'text',
        text: '标题：测试标题\n作者：测试作者\n链接：https://www.pixiv.net/artworks/123',
      },
      { type: 'image', path: imagePath },
    ]);
  });

  it('本地已有同 ID + 索引图片时直接复用，不再请求页列表或下载', async () => {
    const cachedPath = join(dir, '123_1.png');
    await writeFile(cachedPath, 'cached-bytes');

    const result = await execute('原神');

    expect(requestJsonMock).toHaveBeenCalledTimes(1);
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.stringContaining('/ajax/search/artworks/'),
      { cookie: config.cookie, proxy: config.proxy },
    );
    expect(downloadImageMock).not.toHaveBeenCalled();
    expect(result?.content?.[1]).toEqual({ type: 'image', path: cachedPath });
  });

  it('首次请求第 1 页并缓存最大页码，之后随机请求缓存中的一页', async () => {
    useSearchBodyWithLastPage(5);

    await execute('缓存页码');
    expect(searchPaths()).toHaveLength(1);
    expect(pageOf(searchPaths()[0] as string)).toBe('1');

    await execute('缓存页码');
    expect(searchPaths()).toHaveLength(2);
    expect(pageOf(searchPaths()[1] as string)).toBe('2');
  });

  it('不同关键词各自缓存', async () => {
    useSearchBodyWithLastPage(5);

    await execute('关键词A');
    await execute('关键词B');

    const paths = searchPaths();
    expect(paths).toHaveLength(2);
    expect(pageOf(paths[0] as string)).toBe('1');
    expect(pageOf(paths[1] as string)).toBe('1');
  });

  it('缓存页码返回空结果时回退第 1 页', async () => {
    requestJsonMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/ajax/search/artworks/')) {
        const page = pageOf(path);
        if (page === '2') {
          return { illustManga: { data: [], lastPage: 5 } } as never;
        }
        return {
          illustManga: { data: searchBody.illustManga.data, lastPage: 5 },
        } as never;
      }
      if (path.startsWith('/ajax/illust/')) return pagesBody as never;
      throw new Error(`unexpected path: ${path}`);
    });

    await execute('过期页码');
    await execute('过期页码');

    expect(searchPaths().map((path) => pageOf(path))).toEqual(['1', '2', '1']);
  });

  it('搜索失败时返回错误文本', async () => {
    requestJsonMock.mockRejectedValue(new Error('网络错误'));

    const result = await execute('原神');

    expect(result?.content).toEqual([{ type: 'text', text: 'Pixiv 搜索失败：网络错误' }]);
    expect(downloadImageMock).not.toHaveBeenCalled();
  });
});
