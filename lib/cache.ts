// lib/cache.ts
// Redis 또는 메모리 캐시 구현

interface CacheOptions {
  ttl?: number; // Time to live (초)
  prefix?: string;
}

// 메모리 캐시 구현 (Redis 없을 때)
class MemoryCache {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private prefix: string;

  constructor(prefix: string = 'chkAI:') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.prefix + key;
      const entry = this.cache.get(fullKey);
      
      if (!entry) {
        return null;
      }

      // 만료 확인
      if (entry.expiresAt < Date.now()) {
        this.cache.delete(fullKey);
        return null;
      }

      return entry.value as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.prefix + key;
      const expiresAt = Date.now() + (ttl || 3600) * 1000; // 기본 1시간
      
      this.cache.set(fullKey, {
        value,
        expiresAt,
      });

      // 주기적으로 만료된 항목 정리
      if (this.cache.size > 1000) {
        this.cleanExpired();
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.prefix + key;
      this.cache.delete(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (!pattern) {
        this.cache.clear();
        return;
      }

      const keysToDelete: string[] = [];
      const fullPattern = this.prefix + pattern;

      for (const key of this.cache.keys()) {
        if (key.includes(fullPattern)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  private cleanExpired() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
    };
  }
}

export const cacheService = new MemoryCache();

