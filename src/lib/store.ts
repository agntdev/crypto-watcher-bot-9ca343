import { createRequire } from "node:module";
import { RedisSessionStorage, MemorySessionStorage } from "../toolkit/index.js";
import type { StorageAdapter } from "grammy";
import type { UserData, WatchItem, UserIndex } from "./types.js";

function createDurableAdapter<T>(): StorageAdapter<T> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const require = createRequire(import.meta.url);
    const ioredis = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    return new RedisSessionStorage<T>(client, "data:");
  }
  return new MemorySessionStorage<T>();
}

export class DurableStore<T> {
  private adapter: StorageAdapter<T>;
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.adapter = createDurableAdapter<T>();
  }

  private key(id: string): string {
    return `${this.prefix}:${id}`;
  }

  async get(id: string): Promise<T | undefined> {
    return this.adapter.read(this.key(id));
  }

  async set(id: string, value: T): Promise<void> {
    await this.adapter.write(this.key(id), value);
  }

  async delete(id: string): Promise<void> {
    await this.adapter.delete(this.key(id));
  }

  async has(id: string): Promise<boolean> {
    if (this.adapter.has) {
      return this.adapter.has(this.key(id));
    }
    const val = await this.adapter.read(this.key(id));
    return val !== undefined;
  }
}

let userStoreInstance: DurableStore<UserData> | null = null;
let watchStoreInstance: DurableStore<WatchItem> | null = null;
let indexStoreInstance: DurableStore<UserIndex> | null = null;

export function getUserStore(): DurableStore<UserData> {
  if (!userStoreInstance) userStoreInstance = new DurableStore<UserData>("user");
  return userStoreInstance;
}

export function getWatchStore(): DurableStore<WatchItem> {
  if (!watchStoreInstance) watchStoreInstance = new DurableStore<WatchItem>("watch");
  return watchStoreInstance;
}

export function getIndexStore(): DurableStore<UserIndex> {
  if (!indexStoreInstance) indexStoreInstance = new DurableStore<UserIndex>("index");
  return indexStoreInstance;
}

export function resetStores(): void {
  userStoreInstance = null;
  watchStoreInstance = null;
  indexStoreInstance = null;
}
