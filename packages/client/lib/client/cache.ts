import { EventEmitter } from 'stream';
import RedisClient from '.';
import { RedisArgument, ReplyUnion, TransformReply, TypeMapping } from '../RESP/types';
import { BasicCommandParser } from './parser';

type CachingClient = RedisClient<any, any, any, any, any>;
type CmdFunc = () => Promise<ReplyUnion>;

type EvictionPolicy = "LRU" | "FIFO"

export interface ClientSideCacheConfig {
  ttl?: number;
  maxEntries?: number;
  evictPolocy?: EvictionPolicy;
}

type CacheCreator = {
  epoch: number;
  client: CachingClient;
};

interface ClientSideCacheEntry {
  invalidate(): void;
  validate(): boolean;
}

function generateCacheKey(redisArgs: ReadonlyArray<RedisArgument>): string {
  const tmp = new Array(redisArgs.length*2);

  for (let i = 0; i < redisArgs.length; i++) {
    tmp[i] = redisArgs[i].length;
    tmp[i+redisArgs.length] = redisArgs[i];
  }

  return tmp.join('_');
}

abstract class ClientSideCacheEntryBase implements ClientSideCacheEntry {
  #invalidated = false;
  readonly #expireTime: number;

  constructor(ttl: number) {
    if (ttl == 0) {
      this.#expireTime = 0;
    } else {
      this.#expireTime = Date.now() + ttl;
    }
  }

  invalidate(): void {
    this.#invalidated = true;
  }

  validate(): boolean {
    return !this.#invalidated && (this.#expireTime == 0 || (Date.now() < this.#expireTime))
  }
}

class ClientSideCacheEntryValue extends ClientSideCacheEntryBase {
  readonly #value: any;

  get value() {
    return this.#value;
  }

  constructor(ttl: number, value: any) {
    super(ttl);
    this.#value = value;
  }
}

class ClientSideCacheEntryPromise extends ClientSideCacheEntryBase {
  readonly #sendCommandPromise: Promise<ReplyUnion>;

  get promise() {
    return this.#sendCommandPromise;
  }

  constructor(ttl: number, sendCommandPromise: Promise<ReplyUnion>) {
    super(ttl);
    this.#sendCommandPromise = sendCommandPromise;
  }
}

export abstract class ClientSideCacheProvider extends EventEmitter {
  abstract handleCache(client: CachingClient, parser: BasicCommandParser, fn: CmdFunc, transformReply: TransformReply | undefined, typeMapping: TypeMapping | undefined): Promise<any>;
  abstract trackingOn(): Array<RedisArgument>;
  abstract invalidate(key: RedisArgument | null): void;
  abstract clear(): void;
  abstract cacheHits(): number;
  abstract cacheMisses(): number;
  abstract onError(): void;
  abstract onClose(): void;
}

export class BasicClientSideCache extends ClientSideCacheProvider {
  #cacheKeyToEntryMap: Map<string, ClientSideCacheEntry>;
  #keyToCacheKeySetMap: Map<string, Set<string>>;
  readonly ttl: number;
  readonly maxEntries: number;
  readonly lru: boolean;
  #cacheHits = 0;
  #cacheMisses = 0;

  constructor(config?: ClientSideCacheConfig) {
    super();

    this.#cacheKeyToEntryMap = new Map<string, ClientSideCacheEntry>();
    this.#keyToCacheKeySetMap = new Map<string, Set<string>>();
    this.ttl = config?.ttl ?? 0;
    this.maxEntries = config?.maxEntries ?? 0;
    this.lru = config?.evictPolocy !== "FIFO"
  }

  /* logic of how caching works:

  1. commands use a CommandParser
    it enables us to define/retrieve
      cacheKey - a unique key that corresponds to this command and its arguments
      redisKeys - an array of redis keys as strings that if the key is modified, will cause redis to invalidate this result when cached
  2. check if cacheKey is in our cache
    2b1. if its a value cacheEntry - return it
    2b2. if it's a promise cache entry - wait on promise and then go to 3c.
  3. if cacheEntry is not in cache
    3a. send the command save the promise into a a cacheEntry and then wait on result
    3b. transform reply (if required) based on transformReply
    3b. check the cacheEntry is still valid - in cache and hasn't been deleted)
    3c. if valid - overwrite with value entry
  4. return previously non cached result
  */
  override async handleCache(
    client: CachingClient,
    parser: BasicCommandParser,
    fn: CmdFunc,
    transformReply: TransformReply | undefined,
    typeMapping: TypeMapping | undefined
  ) {
    let reply: ReplyUnion;

    const cacheKey = generateCacheKey(parser.redisArgs);

    // "2"
    let cacheEntry = this.get(cacheKey);
    if (cacheEntry) {
      // If instanceof is "too slow", can add a "type" and then use an "as" cast to call proper getters.
      if (cacheEntry instanceof ClientSideCacheEntryValue) { // "2b1"
        this.#cacheHit();

        return structuredClone(cacheEntry.value);
      } else if (cacheEntry instanceof ClientSideCacheEntryPromise) { // 2b2
        // unsure if this should be considered a cache hit, a miss, or neither?
        reply = await cacheEntry.promise;
      } else {
        throw new Error("unknown cache entry type");
      }
    } else { // 3/3a
      this.#cacheMiss();
      
      const promise = fn();

      cacheEntry = this.createPromiseEntry(client, promise);
      this.set(cacheKey, cacheEntry, parser.keys);

      try {
        reply = await promise;
      } catch (err) {
        if (cacheEntry.validate()) { // on error, have to remove promise from cache
          this.delete(cacheKey!);
        }
        
        throw err;
      }
    }

    // 3b
    let val;
    if (transformReply) {
      val = transformReply(reply, parser.preserve, typeMapping);
    } else {
      val = reply;
    }

    // 3c
    if (cacheEntry.validate()) { // revalidating promise entry (dont save value, if promise entry has been invalidated)
      // 3d
      cacheEntry = this.createValueEntry(client, val);
      this.set(cacheKey, cacheEntry, parser.keys);
      this.emit("cached-key", cacheKey);
    } else {
//      console.log("cache entry for key got invalidated between execution and saving, so not saving");
    }

    return structuredClone(val);
  }

  override trackingOn() {
    return ['CLIENT', 'TRACKING', 'ON'];
  }

  override invalidate(key: RedisArgument | null) {
    if (key === null) {
      this.clear(false);
      this.emit("invalidate", key);

      return;
    }

    const keySet = this.#keyToCacheKeySetMap.get(key.toString());
    if (keySet) {     
      for (const cacheKey of keySet) {
        const entry = this.#cacheKeyToEntryMap.get(cacheKey);
        if (entry) {
          entry.invalidate();
        }
        this.#cacheKeyToEntryMap.delete(cacheKey);
      }
      this.#keyToCacheKeySetMap.delete(key.toString());
    }

    this.emit('invalidate', key);
  }

  override clear(resetStats = true) {
    this.#cacheKeyToEntryMap.clear();
    this.#keyToCacheKeySetMap.clear();
    if (resetStats) {
      this.#cacheHits = 0;
      this.#cacheMisses = 0;
    }
  }

  get(cacheKey: string) {
    const val = this.#cacheKeyToEntryMap.get(cacheKey);

    if (val && !val.validate()) {
      this.delete(cacheKey);
      this.emit("cache-evict", cacheKey);

      return undefined;
    }

    if (val !== undefined && this.lru) {
      this.#cacheKeyToEntryMap.delete(cacheKey);
      this.#cacheKeyToEntryMap.set(cacheKey, val);
    }

    return val;
  }

  delete(cacheKey: string) {
    const entry = this.#cacheKeyToEntryMap.get(cacheKey);
    if (entry) {
      entry.invalidate();
      this.#cacheKeyToEntryMap.delete(cacheKey);
    }
  }

  has(cacheKey: string) {
    return this.#cacheKeyToEntryMap.has(cacheKey);
  }

  set(cacheKey: string, cacheEntry: ClientSideCacheEntry, keys: Array<RedisArgument>) {
    let count = this.#cacheKeyToEntryMap.size;
    const oldEntry = this.#cacheKeyToEntryMap.get(cacheKey);

    if (oldEntry) {
      count--; // overwriting, so not incrementig
      oldEntry.invalidate();
    }

    if (this.maxEntries > 0 && count >= this.maxEntries) {
      this.deleteOldest();
    }

    this.#cacheKeyToEntryMap.set(cacheKey, cacheEntry);

    for (const key of keys) {
      if (!this.#keyToCacheKeySetMap.has(key.toString())) {
        this.#keyToCacheKeySetMap.set(key.toString(), new Set<string>());
      }

      const cacheKeySet = this.#keyToCacheKeySetMap.get(key.toString());
      cacheKeySet!.add(cacheKey);
    }
  }

  size() {
    return this.#cacheKeyToEntryMap.size;
  }

  createValueEntry(client: CachingClient, value: any): ClientSideCacheEntryValue {
    return new ClientSideCacheEntryValue(this.ttl, value);
  }

  createPromiseEntry(client: CachingClient, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise {
    return new ClientSideCacheEntryPromise(this.ttl, sendCommandPromise);
  }

  #cacheHit(): void {
    this.#cacheHits++;
  }

  #cacheMiss(): void {
    this.#cacheMisses++;
  }

  override cacheHits(): number {
    return this.#cacheHits;
  }

  override cacheMisses(): number {
    return this.#cacheMisses;
  }

  override onError(): void {
    this.clear();
  }

  override onClose() {
    this.clear();
  }

  /**
   * @internal
   */
  deleteOldest() {
    const it = this.#cacheKeyToEntryMap[Symbol.iterator]();
    const n = it.next();
    if (!n.done) {
      this.#cacheKeyToEntryMap.delete(n.value[0]);
    }
  }

  /**
   * @internal
   */
  entryEntries() {
    return this.#cacheKeyToEntryMap.entries();
  }

  /**
   * @internal
   */
  keySetEntries() {
    return this.#keyToCacheKeySetMap.entries();
  }
}

export abstract class PooledClientSideCacheProvider extends BasicClientSideCache {
  #disabled = false;

  disable() {
    this.#disabled = true;
  }

  enable() {
    this.#disabled = false;
  }

  override get(cacheKey: string) {
    if (this.#disabled) {
      return undefined;
    }

    return super.get(cacheKey);
  }

  override has(cacheKey: string) {
    if (this.#disabled) {
      return false;
    }

    return super.has(cacheKey);
  }  
  
  onPoolClose() {
    this.clear();
  };
}

// doesn't do anything special in pooling, clears cache on every client disconnect
export class BasicPooledClientSideCache extends PooledClientSideCacheProvider {
  override onError() {
    this.clear(false);
  }

  override onClose() {
    this.clear(false);
  }
}

class PooledClientSideCacheEntryValue extends ClientSideCacheEntryValue {
  #creator: CacheCreator;

  constructor(ttl: number, creator: CacheCreator, value: any) {
    super(ttl, value);

    this.#creator = creator;
  }

  override validate(): boolean {
    let ret = super.validate();
    if (this.#creator) {
      ret = ret && this.#creator.client.isReady && this.#creator.client.socketEpoch == this.#creator.epoch
    }

    return ret;
  }
}

class PooledClientSideCacheEntryPromise extends ClientSideCacheEntryPromise {
  #creator: CacheCreator;

  constructor(ttl: number, creator: CacheCreator, sendCommandPromise: Promise<ReplyUnion>) {
    super(ttl, sendCommandPromise);

    this.#creator = creator;
  }

  override validate(): boolean {
    let ret = super.validate();
    
    return ret && this.#creator.client.isReady && this.#creator.client.socketEpoch == this.#creator.epoch
  }
}

// Doesn't clear cache on client disconnect, validates entries on retrieval
export class PooledNoRedirectClientSideCache extends BasicPooledClientSideCache {
  override createValueEntry(client: CachingClient, value: any): ClientSideCacheEntryValue {
    const creator = {
      epoch: client.socketEpoch,
      client: client
    };

    return new PooledClientSideCacheEntryValue(this.ttl, creator, value);
  }

  override createPromiseEntry(client: CachingClient, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise {
    const creator = {
      epoch: client.socketEpoch,
      client: client
    };

    return new PooledClientSideCacheEntryPromise(this.ttl, creator, sendCommandPromise);
  }

  // don't clear cache on error here
  override onError() {}

  override onClose() {}
}