import { defineCommand } from '@xopenbot/plugin';
import { ensureLocalImage } from '../services/image-cache.js';
import { searchRandomPixivImage } from '../services/pixiv-search.js';
import type { PixivConfig, PixivManifest } from '../types/index.js';

const USAGE = '用法：pixiv <关键词>，例如 pixiv 原神';

export const pixivCommand = defineCommand<PixivManifest>(
  'pixiv [keyword...]',
  '根据关键词搜索 Pixiv 图片',
)
  .alias('p站')
  .priority(10)
  .handler(async (_input, ctx, args) => {
    const keyword = ((args.keyword as string[] | undefined) ?? []).join(' ').trim();
    if (!keyword) {
      return { content: [{ type: 'text', text: USAGE }] };
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
      return { content: [{ type: 'text', text: `Pixiv 搜索失败：${message}` }] };
    }
  })
  .help()
  .build();
