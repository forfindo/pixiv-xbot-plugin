import type { Command } from '@xopenbot/plugin';
import { ensureLocalImage } from '../services/image-cache.js';
import { searchRandomPixivImage } from '../services/pixiv-search.js';
import type { PixivConfig, PixivManifest } from '../types/index.js';

export const pixivCommand: Command<PixivManifest> = {
  name: 'pixiv',
  pattern: /^(?:pixiv|p站)\s*/i,
  priority: 100,
  async execute(input, ctx) {
    const keyword = input.trim();
    if (!keyword) {
      return {
        content: [{ type: 'text', text: '用法：pixiv <关键词>，例如 pixiv 原神' }],
      };
    }

    const config = ctx.state.pixivConfig as PixivConfig;

    try {
      const image = await searchRandomPixivImage(keyword, config);
      const imagePath = await ensureLocalImage(image, config);

      return {
        content: [
          {
            type: 'text',
            text: `标题：${image.title}\n作者：${image.author}\n链接：${image.pageUrl}`,
          },
          { type: 'image', path: imagePath },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Pixiv 搜索失败：${message}` }],
      };
    }
  },
};
