import { definePlugin } from '@xopenbot/plugin';
import { commands } from './commands/index.js';
import { loadCookie } from './services/cookie-store.js';
import type { PixivConfig } from './types/index.js';

export const pixivPlugin = definePlugin<PixivConfig>()({
  info: {
    name: 'pixiv',
    version: '1.0.0',
    description: '根据关键词搜索 Pixiv 图片',
    manifest: {
      depsOn: {},
    },
  },
  async init({state, config}) {
    await loadCookie(config);
    state.pixivConfig = config;
    return {};
  },
  loadCommand() {
    return commands;
  },
});

export default pixivPlugin;
