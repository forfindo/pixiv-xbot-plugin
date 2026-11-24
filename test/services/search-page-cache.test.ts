import { describe, expect, it } from 'vitest';
import { SearchPageCache } from '../../src/services/search-page-cache.js';

describe('SearchPageCache', () => {
  it('未命中返回 undefined，写入后按页码返回', () => {
    const cache = new SearchPageCache(10);

    expect(cache.get('a')).toBeUndefined();

    cache.set('a', 3);
    expect(cache.get('a')).toBe(3);
  });

  it('页码会被修正为至少 1', () => {
    const cache = new SearchPageCache(10);

    cache.set('a', 0);
    expect(cache.get('a')).toBe(1);
  });

  it('超过上限时淘汰命中次数最少的', () => {
    const cache = new SearchPageCache(2);

    cache.set('a', 1);
    cache.set('b', 1);
    cache.get('a');
    cache.set('c', 1);

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(1);
  });

  it('命中次数相同时淘汰最久未使用的', () => {
    const cache = new SearchPageCache(2);

    cache.set('a', 1);
    cache.set('b', 1);
    cache.set('c', 1);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(1);
    expect(cache.get('c')).toBe(1);
  });

  it('更新已存在的 key 不会重置命中次数', () => {
    const cache = new SearchPageCache(2);

    cache.set('a', 1);
    cache.get('a');
    cache.set('b', 1);
    cache.set('a', 5);
    cache.set('c', 1);

    expect(cache.get('a')).toBe(5);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(1);
  });
});
