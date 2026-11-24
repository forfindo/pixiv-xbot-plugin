import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pixivCookieCommand } from '../../src/commands/cookie.js';
import type { PixivConfig } from '../../src/types/index.js';

type ExecCtx = Parameters<typeof pixivCookieCommand.execute>[1];

let dir: string;
let config: PixivConfig;

const createCtx = (): ExecCtx => ({ state: { pixivConfig: config } }) as unknown as ExecCtx;
const cookieFile = () => join(dir, 'cookie.txt');

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pixiv-ck-'));
  config = {
    proxy: 'http://127.0.0.1:7890',
    cookie: '',
    cacheDir: dir,
  };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('pixivCookieCommand.execute', () => {
  it('未设置时显示空状态', async () => {
    const result = await pixivCookieCommand.execute('', createCtx());

    expect(result?.content).toEqual([
      {
        type: 'text',
        text: `当前 Pixiv Cookie：（未设置）\n代理：${config.proxy}\n缓存目录：${dir}`,
      },
    ]);
  });

  it('设置 Cookie 并写入文件', async () => {
    const result = await pixivCookieCommand.execute(
      'set PHPSESSID=abc123',
      createCtx(),
    );

    expect(config.cookie).toBe('PHPSESSID=abc123');
    expect(await readFile(cookieFile(), 'utf8')).toBe('PHPSESSID=abc123');
    expect(result?.content).toEqual([
      { type: 'text', text: '已设置 Pixiv Cookie（共 16 字符）' },
    ]);
  });

  it('set 缺少值时返回用法', async () => {
    const result = await pixivCookieCommand.execute('set', createCtx());

    expect(result?.content).toEqual([
      { type: 'text', text: '用法：pixiv ck set <cookie>' },
    ]);
    expect(await exists(cookieFile())).toBe(false);
  });

  it('查看时对 Cookie 脱敏', async () => {
    config.cookie = 'PHPSESSID=abcdefghijklmnop';

    const result = await pixivCookieCommand.execute('show', createCtx());
    const text = (result?.content?.[0] as { text: string }).text;

    expect(text).toContain('PHPSES...mnop');
    expect(text).not.toContain('PHPSESSID=abcdefghijklmnop');
  });

  it('清除 Cookie 并删除文件', async () => {
    config.cookie = 'session=token';
    await writeFile(cookieFile(), config.cookie);

    const result = await pixivCookieCommand.execute('clear', createCtx());

    expect(config.cookie).toBe('');
    expect(await exists(cookieFile())).toBe(false);
    expect(result?.content).toEqual([{ type: 'text', text: '已清除 Pixiv Cookie' }]);
  });

  it('del 与 delete 也能清除', async () => {
    config.cookie = 'session=token';

    await pixivCookieCommand.execute('del', createCtx());
    expect(config.cookie).toBe('');

    config.cookie = 'session=token';
    await pixivCookieCommand.execute('delete', createCtx());
    expect(config.cookie).toBe('');
  });

  it('未知子命令返回用法', async () => {
    const result = await pixivCookieCommand.execute('unknown', createCtx());

    expect(result?.content).toEqual([
      {
        type: 'text',
        text: [
          'pixiv ck —— 查看当前 Cookie',
          'pixiv ck set <cookie> —— 设置 Cookie',
          'pixiv ck clear —— 清除 Cookie',
        ].join('\n'),
      },
    ]);
  });
});
