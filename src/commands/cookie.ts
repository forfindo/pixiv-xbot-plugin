import { defineCommand } from '@xopenbot/plugin';
import { clearCookie, saveCookie } from '../services/cookie-store.js';
import type { PixivConfig, PixivManifest } from '../types/index.js';

const HELP_HINT = '使用 pixiv ck --help 查看支持的操作';

function maskCookie(cookie: string): string {
  if (!cookie) return '（未设置）';
  if (cookie.length <= 12) return `${cookie.slice(0, 2)}***`;
  return `${cookie.slice(0, 6)}...${cookie.slice(-4)}（共 ${cookie.length} 字符）`;
}

function showCookie(config: PixivConfig) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `当前 Pixiv Cookie：${maskCookie(config.cookie)}\n代理：${config.proxy}\n缓存目录：${config.cacheDir}`,
      },
    ],
  };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: `Cookie 操作失败：${message}` }] };
}

export const pixivCookieCommand = defineCommand<PixivManifest>('pixiv ck', '管理 Pixiv Cookie')
  .name('pixiv-ck')
  .alias('p站')
  .priority(9)
  .help()
  .handler((_input, ctx, args) => {
    const config = ctx.state.pixivConfig as PixivConfig;

    if (args._.length <= 2) {
      return showCookie(config);
    }
    return { content: [{ type: 'text' as const, text: HELP_HINT }] };
  })
  .command(
    defineCommand<PixivManifest>('show', '查看当前 Cookie')
      .priority(8)
      .handler((_input, ctx) => showCookie(ctx.state.pixivConfig as PixivConfig)),
  )
  .command(
    defineCommand<PixivManifest>(['clear', 'del', 'delete'], '清除 Cookie（别名 del / delete）')
      .priority(8)
      .handler(async (_input, ctx) => {
        const config = ctx.state.pixivConfig as PixivConfig;
        try {
          await clearCookie(config);
          return { content: [{ type: 'text' as const, text: '已清除 Pixiv Cookie' }] };
        } catch (error) {
          return fail(error);
        }
      }),
  )
  .command(
    defineCommand<PixivManifest>('set <cookie...>', '设置 Cookie')
      .priority(8)
      .handler(async (_input, ctx, args) => {
        const config = ctx.state.pixivConfig as PixivConfig;
        const value = ((args.cookie as string[] | undefined) ?? []).join(' ').trim();

        if (!value) {
          return { content: [{ type: 'text' as const, text: HELP_HINT }] };
        }

        try {
          await saveCookie(config, value);
          return {
            content: [
              { type: 'text' as const, text: `已设置 Pixiv Cookie（共 ${value.length} 字符）` },
            ],
          };
        } catch (error) {
          return fail(error);
        }
      }),
  )
  .build();
