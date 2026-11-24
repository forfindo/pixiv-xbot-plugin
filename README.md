# pixiv-xbot-plugin

基于 `@xopenbot/plugin@0.0.7` 的 Pixiv 搜图插件。发送关键词即可随机获取一张 Pixiv 作品图片。

## 目录结构

```
index.ts              # 模块出口，只导出插件
src/
  plugin.ts           # 插件组装
  commands/           # 命令层
    index.ts          # 命令汇总
    pixiv.ts          # 搜图命令
    cookie.ts         # Cookie 管理命令
  services/           # 业务层
    pixiv-search.ts   # Pixiv 搜索与随机选图
    search-page-cache.ts # 关键词最大页码缓存（LFU）
    image-cache.ts    # 图片本地缓存
    cookie-store.ts   # Cookie 持久化
  infra/              # 基础设施层
    http.ts           # https-proxy-agent 代理请求
    constants.ts      # 常量
  types/              # 类型层
    index.ts          # 类型汇总
    config.ts         # 配置与请求选项
    http.ts           # HTTP 响应类型
    pixiv.ts          # Pixiv 数据类型
test/
  commands/           # 命令 execute 单元测试
    pixiv.test.ts
    cookie.test.ts
  services/           # 服务层单元测试
    search-page-cache.test.ts
  live/               # 真实请求 pixiv.net 的测试
    pixiv-live.test.ts
```

## 安装

作为插件放入 bot 的 `plugins` 目录（例如 `paimon` 的 `plugins/pixiv-xbot-plugin`），然后安装依赖：

```bash
pnpm install
```

在主程序中注册：

```ts
import PixivPlugin from './plugins/pixiv-xbot-plugin/index.js';

await workspace.registry(PixivPlugin);
```

## 使用

```
pixiv 原神
p站 初音ミク
```

命令匹配后会移除 `pixiv` / `p站` 前缀，剩余内容作为搜索关键词。插件返回标题、作者、作品链接以及图片。

Cookie 管理：

```
pixiv ck                    查看当前 Cookie（已脱敏）
pixiv ck set <cookie>       设置 Cookie
pixiv ck clear              清除 Cookie
```

> Cookie 会持久化到 `<cacheDir>/cookie.txt`，插件启动时若文件存在会自动恢复；`clear` 会删除该文件。

## 配置

配置在 `src/plugin.ts` 的 `init` 中写入插件专属的 `ctx.state`，无需环境变量，也不会污染其他插件：

```ts
init(ctx) {
  ctx.state.pixivConfig = {
    proxy: 'http://127.0.0.1:7890',
    cookie: '',
    cacheDir: resolve('data/pixiv'),
  } satisfies PixivConfig;
  return {};
}
```

命令通过 `ctx.state.pixivConfig` 读取配置。

| 字段 | 说明 |
| --- | --- |
| `proxy` | HTTP(S) 代理地址，由 `https-proxy-agent@9.1.0` 处理 |
| `cookie` | Pixiv Cookie，可用于 R18 或需要登录的场景 |
| `cacheDir` | 图片本地缓存目录，按作品 ID 命名，默认 `data/pixiv` |

## 测试

测试覆盖命令的 `execute` 函数：

- `test/commands`：在 HTTP 边界 mock，验证命令逻辑、搜索选图、缓存与 Cookie 读写
- `test/live`：通过 `http://127.0.0.1:7897` 真实请求 `pixiv.net`，下载并保存图片（不会修改源码配置）

```bash
pnpm test        # 离线单元测试
pnpm test:live   # 真实请求 pixiv.net
pnpm run check   # 类型检查
```

## 实现说明

- 搜索接口参考 `D:\IDEAProject\node-test\index.js`：`/ajax/search/artworks/{keyword}` 与 `/ajax/illust/{id}`。
- 网络请求使用 Node 内置 `https`，代理通过 `https-proxy-agent` 的 `HttpsProxyAgent` 注入，无需手写 `CONNECT`。
- 默认筛选安全内容（`mode=safe`、排除 R18 与 AI 作品），随机挑选一页并按作品原始尺寸取图。
- 最大页码按关键词缓存在内存中（上限 500 条，LFU 淘汰）：首次搜索只请求第 1 页，之后随机请求缓存范围内的某一页；页码请求为空时回退第 1 页。
- 下载时调用 `/ajax/illust/{id}/pages` 获取所有页，随机选一页原图。
- 图片按「作品 ID + 页索引」保存到本地缓存目录（如 `123_1.png`）；返回时优先按 ID + 索引读取本地文件，不存在才下载并保存。
