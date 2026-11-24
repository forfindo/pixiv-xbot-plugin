import { resolve } from 'node:path';
import { definePlugin } from '@xopenbot/plugin';
import { commands } from './commands/index.js';
import { loadCookie } from './services/cookie-store.js';
import type { PixivConfig } from './types/index.js';

export const pixivPlugin = definePlugin({
  info: {
    name: 'pixiv',
    version: '1.0.0',
    description: '根据关键词搜索 Pixiv 图片',
    manifest: {
      depsOn: {},
    },
  },
  async init(ctx) {
    const config = {
      proxy: 'http://127.0.0.1:7890',
      cookie: '',
      cacheDir: resolve('data/pixiv'),
    } satisfies PixivConfig;

    await loadCookie(config);
    ctx.state.pixivConfig = config;
    return {};
  },
  loadCommand() {
    return commands;
  },
});

export default pixivPlugin;
