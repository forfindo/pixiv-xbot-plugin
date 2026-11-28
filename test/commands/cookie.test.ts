import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pixivCookieCommand } from '../../src/commands/cookie.js';
import type { PixivConfig } from '../../src/types/index.js';

const command = pixivCookieCommand.find((item) => item.name === 'pixiv-ck')!;
const showCommand = pixivCookieCommand.find((item) => item.name === 'show')!;
const clearCommand = pixivCookieCommand.find((item) => item.name === 'clear')!;
const setCommand = pixivCookieCommand.find((item) => item.name === 'set')!;

type ExecCtx = Parameters<typeof command.execute>[1];
type ExecArgs = Parameters<typeof command.execute>[2];

let dir: string;
let config: PixivConfig;

const createCtx = (): ExecCtx => ({ state: { pixivConfig: config } }) as unknown as ExecCtx;

function execute(text: string) {
  const value = text.trim();
  const tokens = value ? value.split(/\s+/) : [];
  const action = tokens[0]?.toLowerCase();
  const args = { _: ['pixiv', 'ck', ...tokens] } as unknown as ExecArgs;

  if (action === 'set') {
    return setCommand.execute(`pixiv ck ${value}`, createCtx(), {
      ...args,
      cookie: tokens.slice(1),
    });
  }

  if (action === 'show') {
    return showCommand.execute(`pixiv ck ${value}`, createCtx(), args);
  }

  if (action === 'clear' || action === 'del' || action === 'delete') {
    return clearCommand.execute(`pixiv ck ${value}`, createCtx(), args);
  }

  return command.execute(`pixiv ck${value ? ` ${value}` : ''}`, createCtx(), args);
}
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
    const result = await execute('');

    expect(result?.content).toEqual([
      {
        type: 'text',
        text: `当前 Pixiv Cookie：（未设置）\n代理：${config.proxy}\n缓存目录：${dir}`,
      },
    ]);
  });

  it('设置 Cookie 并写入文件', async () => {
    const result = await execute('set PHPSESSID=abc123');

    expect(config.cookie).toBe('PHPSESSID=abc123');
    expect(await readFile(cookieFile(), 'utf8')).toBe('PHPSESSID=abc123');
    expect(result?.content).toEqual([
      { type: 'text', text: '已设置 Pixiv Cookie（共 16 字符）' },
    ]);
  });

  it('set 缺少值时提示查看帮助', async () => {
    const result = await execute('set');

    expect(result?.content).toEqual([
      { type: 'text', text: '使用 pixiv ck --help 查看支持的操作' },
    ]);
    expect(await exists(cookieFile())).toBe(false);
  });

  it('查看时对 Cookie 脱敏', async () => {
    config.cookie = 'PHPSESSID=abcdefghijklmnop';

    const result = await execute('show');
    const text = (result?.content?.[0] as { text: string }).text;

    expect(text).toContain('PHPSES...mnop');
    expect(text).not.toContain('PHPSESSID=abcdefghijklmnop');
  });

  it('清除 Cookie 并删除文件', async () => {
    config.cookie = 'session=token';
    await writeFile(cookieFile(), config.cookie);

    const result = await execute('clear');

    expect(config.cookie).toBe('');
    expect(await exists(cookieFile())).toBe(false);
    expect(result?.content).toEqual([{ type: 'text', text: '已清除 Pixiv Cookie' }]);
  });

  it('del 与 delete 也能清除', async () => {
    config.cookie = 'session=token';

    await execute('del');
    expect(config.cookie).toBe('');

    config.cookie = 'session=token';
    await execute('delete');
    expect(config.cookie).toBe('');
  });

  it('未知子命令提示查看帮助', async () => {
    const result = await execute('unknown');

    expect(result?.content).toEqual([
      { type: 'text', text: '使用 pixiv ck --help 查看支持的操作' },
    ]);
  });
});
