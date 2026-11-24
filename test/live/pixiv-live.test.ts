import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pixivCommand } from '../../src/commands/pixiv.js';
import type { PixivConfig } from '../../src/types/index.js';

const config: PixivConfig = {
  proxy: 'http://127.0.0.1:7897',
  cookie: '',
  cacheDir: resolve('data/pixiv'),
};

type ExecCtx = Parameters<typeof pixivCommand.execute>[1];

describe('pixivCommand.execute（真实请求）', () => {
  it('经 127.0.0.1:7897 请求 pixiv.net 并保存图片', async () => {
    const ctx = { state: { pixivConfig: config } } as unknown as ExecCtx;
    const result = await pixivCommand.execute('芙宁娜', ctx);

    const image = result?.content?.[1];
    expect(image).toMatchObject({ type: 'image' });

    const imagePath = (image as { path: string }).path;
    const info = await stat(imagePath);
    expect(info.size).toBeGreaterThan(0);

    console.log('作品信息：', (result?.content?.[0] as { text: string }).text);
    console.log('已保存：', imagePath, `${info.size} bytes`);
  }, 0);
});
