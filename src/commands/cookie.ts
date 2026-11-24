import type { Command } from '@xopenbot/plugin';
import { clearCookie, saveCookie } from '../services/cookie-store.js';
import type { PixivConfig, PixivManifest } from '../types/index.js';

const USAGE = [
  'pixiv ck —— 查看当前 Cookie',
  'pixiv ck set <cookie> —— 设置 Cookie',
  'pixiv ck clear —— 清除 Cookie',
].join('\n');

function maskCookie(cookie: string): string {
  if (!cookie) return '（未设置）';
  if (cookie.length <= 12) return `${cookie.slice(0, 2)}***`;
  return `${cookie.slice(0, 6)}...${cookie.slice(-4)}（共 ${cookie.length} 字符）`;
}

export const pixivCookieCommand: Command<PixivManifest> = {
  name: 'pixiv-ck',
  pattern: /^(?:pixiv|p站)\s+ck\s*/i,
  priority: 9,
  async execute(input, ctx) {
    const config = ctx.state.pixivConfig as PixivConfig;
    const text = input.trim();
    const matched = /^(set|show|clear|del|delete)\b\s*([\s\S]*)$/i.exec(text);
    const action = matched?.[1]?.toLowerCase();
    const value = matched?.[2]?.trim() ?? '';

    if (!text || action === 'show') {
      return {
        content: [
          {
            type: 'text',
            text: `当前 Pixiv Cookie：${maskCookie(config.cookie)}\n代理：${config.proxy}\n缓存目录：${config.cacheDir}`,
          },
        ],
      };
    }

    try {
      if (action === 'set') {
        if (!value) {
          return { content: [{ type: 'text', text: '用法：pixiv ck set <cookie>' }] };
        }
        await saveCookie(config, value);
        return {
          content: [{ type: 'text', text: `已设置 Pixiv Cookie（共 ${value.length} 字符）` }],
        };
      }

      if (action === 'clear' || action === 'del' || action === 'delete') {
        await clearCookie(config);
        return { content: [{ type: 'text', text: '已清除 Pixiv Cookie' }] };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Cookie 操作失败：${message}` }] };
    }

    return { content: [{ type: 'text', text: USAGE }] };
  },
};
