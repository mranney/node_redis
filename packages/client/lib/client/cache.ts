import RedisClient from '.';
import { Command, ReplyUnion, TransformReply } from '../RESP/types';

type CachingClient = RedisClient<any, any, any, any, any>;
type CmdFunc = () => Promise<ReplyUnion>;

export interface ClientSideCacheConfig {
  ttl: number;
  maxEntries: number;
  lru: boolean;
}

type CacheCreator = {
  epoch: number;
  client: CachingClient;
};

interface ClientSideCacheEntry {
  invalidate(): void;
  validate(): boolean;
}

abstract class ClientSideCacheEntryBase implements ClientSideCacheEntry {
  #invalidated = false;
  readonly #ttl: number;
  readonly #created: number;

  constructor(ttl: number) {
    this.#ttl = ttl;
    this.#created = Date.now();
  }

  invalidate(): void {
    this.#invalidated = true;
  }

  validate(): boolean {
    return !this.#invalidated && (this.#ttl == 0 || (Date.now() - this.#created) < this.#ttl)
  }
}

export class ClientSideCacheEntryValue extends ClientSideCacheEntryBase {
  readonly #value: any;

  get value() {
    return this.#value;
  }

  constructor(ttl: number, value: any) {
    super(ttl);
    this.#value = value;
  }
}

export class ClientSideCacheEntryPromise extends ClientSideCacheEntryBase {
  readonly #sendCommandPromise: Promise<ReplyUnion>;

  get promise() {
    return this.#sendCommandPromise;
  }

  constructor(ttl: number, sendCommandPromise: Promise<ReplyUnion>) {
    super(ttl);
    this.#sendCommandPromise = sendCommandPromise;
  }
}

/*
The reason for using abstract class vs interface, is that interfaces aren't part of the type hierarchy, abstract classes are
Therefore, one can restrict union types with a `instanceof abstract class` that one can't do with union types.
This allows us to easily have a clientSideCache config option that takes a ClientSideCacheProvider object or a config statement and
easily distinguish them in code.
i.e.
  clientSideCache?: ClientSideCacheProvider | ClientSideCacheConfig;
and
  if (clientSideCache) {
    if (clientSideCache instance of ClientSideCacheProvider) {
      ...
    } else {
      // it's a ClientSideCacheConfig object
    }
*/
export abstract class ClientSideCacheProvider {
  abstract handleCache(client: CachingClient, cmd: Command, args: Array<unknown>, fn: CmdFunc, transformReply: TransformReply, preserve?: any): Promise<any>;
  abstract trackingOn(): Array<string>;
  abstract invalidate(key: string): void;
  abstract clear(): void;
  abstract cacheHits(): number;
  abstract cacheMisses(): number;
  abstract clearOnReconnect(): boolean;
}

export class BasicClientSideCache extends ClientSideCacheProvider {
  #cacheKeyToEntryMap: Map<string, ClientSideCacheEntry>;
  #keytoCacheKeySetMap: Map<string, Set<string>>;
  readonly ttl: number;
  readonly #maxEntries: number;
  readonly #lru: boolean;
  #cacheHits = 0;
  #cacheMisses = 0;

  constructor(ttl: number, maxEntries: number, lru: boolean) {
    super();

    this.#cacheKeyToEntryMap = new Map<string, ClientSideCacheEntry>();
    this.#keytoCacheKeySetMap = new Map<string, Set<string>>();
    this.ttl = ttl;
    this.#maxEntries = maxEntries;
    this.#lru = lru;
  }

  override clearOnReconnect(): boolean {
    return true;
  }

  /* logic of how caching works:

  1. every command that's cachable provide a getCacheInfo(args) function
     This function (if defined for cachable commands) returns a struct with 2 elements,
      cacheKey - a unique key that corresponds to this command and its arguments
      redisKeys - an array of redis keys as strings that if the key is modified, will cause redis to invalidate this result when cached
  2. check if cacheKey is in our cache
    2a. if it is, validate (in the case of a pooled cache without redirect)
    2b1. if valid
    2b1a. if its a value cacheEntry - return it
    2b1b. if it's a promise cache entry - wait on promise and then go to 3c.
  3. if cacheEntry is not in cache
    3a. send the command save the promise into a a cacheEntry and then wait on result
    3b. check the cacheEntry is still valid - in cache and hasn't been deleted)
    3c. if valid - overwrite with value entry
  4. return previously non cached result
  */
  override async handleCache(client: CachingClient, cmd: Command, args: Array<unknown>, fn: CmdFunc, transformReply: TransformReply, preserve?: any) {
    let reply: ReplyUnion;

    // "1" - no caching if typemapping in use.
    const cacheInfo = cmd.getCacheInfo?.(args);
    const cacheKey = cacheInfo?.cacheKey;

    // "2"
    let cacheEntry = this.get(cacheKey);
    if (cacheEntry && !cacheEntry.validate()) { // "2a"
      console.log("invalidating cache entry as old epoch");
      this.delete(cacheKey!);
      cacheEntry = undefined;
    }

    // "2b1"
    if (cacheEntry) {
      if (cacheEntry instanceof ClientSideCacheEntryValue) { // "2b1a"
        console.log("returning value from cache");
        this.cacheHit();

        return cacheEntry.value;
      } else if (cacheEntry instanceof ClientSideCacheEntryPromise) { // 2b1b
        // unsure if this should be considered a cache hit, a miss, or neither?
        reply = await cacheEntry.promise;
      } else {
        throw new Error("unknown cache entry type");
      }
    } else { // 3/3a
      if (cacheInfo) { // something can't be a cache miss if it wasn't cacheable.
        this.cacheMiss();
      }
      const promise = fn();
      if (cacheKey) {
        cacheEntry = this.createPromiseEntry(client, promise);
        this.set(cacheKey, cacheEntry, cacheInfo.redisKeys);
      }
      try {
        reply = await promise;
      } catch (err) {
        if (cacheKey) { // on error, have to remove promise from cache
          this.delete(cacheKey);
        }
        throw err;
      }
    }

    const val = transformReply ? transformReply(reply, preserve) : reply;

    // 3b
    if (cacheInfo) {
      // cacheInfo being defnined implies cachable, which implies that cacheEntry has to exist
      if (cacheEntry!.validate()) { // revalidating promise entry (dont save value, if promise entry has been invalidated)
        // 3c
        console.log("saving value to cache");
        cacheEntry = this.createValueEntry(client, val);
        this.set(cacheInfo.cacheKey, cacheEntry, cacheInfo.redisKeys);
      } else {
        console.log("cache entry for key got invalidated between execution and saving, so not saving");
      }
    }

    return val;
  }

  override trackingOn() {
    return ['CLIENT', 'TRACKING', 'ON'];
  }

  override invalidate(key: string) {
    console.log(`invalidate: ${key}`);
    const set = this.#keytoCacheKeySetMap.get(key);
    if (set) {
     for (const cacheKey of set) {
        console.log(`invalidate: got ${cacheKey} from key ${key} set`);
        const entry = this.#cacheKeyToEntryMap.get(cacheKey);
        if (entry) {
          entry.invalidate();
        }
        this.#cacheKeyToEntryMap.delete(cacheKey);
      }
      this.#keytoCacheKeySetMap.delete(key);
    }
  }

  override clear() {
    this.#cacheKeyToEntryMap.clear();
    this.#keytoCacheKeySetMap.clear();
    this.#cacheHits = 0;
    this.#cacheMisses = 0;
  }

  get(cacheKey?: string | undefined) {
    if (cacheKey === undefined) {
      return undefined
    }

    const val = this.#cacheKeyToEntryMap.get(cacheKey);
    if (val !== undefined && this.#lru) {
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

  set(cacheKey: string, cacheEntry: ClientSideCacheEntry, keys: Array<string>) {
    let count = this.#cacheKeyToEntryMap.size;
    const oldEntry = this.#cacheKeyToEntryMap.get(cacheKey);
    if (oldEntry) {
      count--; // overwriting, so not incrementig
      oldEntry.invalidate();
    }

    if (this.#maxEntries > 0 && count >= this.#maxEntries) {
      this.deleteOldest();
    }

    this.#cacheKeyToEntryMap.set(cacheKey, cacheEntry);

    for (const key of keys) {
      if (!this.#keytoCacheKeySetMap.has(key)) {
        this.#keytoCacheKeySetMap.set(key, new Set<string>());
      }

      const cacheKeySet = this.#keytoCacheKeySetMap.get(key);
      cacheKeySet!.add(cacheKey);
    }
  }

  size() {
    return this.#cacheKeyToEntryMap.size;
  }

  createValueEntry(client: RedisClient<any, any, any, any, any>, value: any): ClientSideCacheEntryValue {
    return new ClientSideCacheEntryValue(this.ttl, value);
  }

  createPromiseEntry(client: RedisClient<any, any, any, any, any>, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise {
    return new ClientSideCacheEntryPromise(this.ttl, sendCommandPromise);
  }

  cacheHit(): void {
    this.#cacheHits++;
  }

  cacheMiss(): void {
    this.#cacheMisses++;
  }

  override cacheHits(): number {
    return this.#cacheHits;
  }

  override cacheMisses(): number {
    return this.#cacheMisses;
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
    return this.#keytoCacheKeySetMap.entries();
  }
}

export abstract class PooledClientSideCacheProvider extends BasicClientSideCache {
  abstract updateRedirect(id: number): void;
  abstract addClient(client: RedisClient<any, any, any, any, any>): void;
  abstract removeClient(client: RedisClient<any, any, any, any, any>): void;
}

// doesn't do anything special in pooling, clears cache on every client disconnect
export class BasicPooledClientSideCache extends PooledClientSideCacheProvider {
  override updateRedirect(id: number): void {
    return;
  }

  override addClient(client: RedisClient<any, any, any, any, any>): void {
    return;
  }
  override removeClient(client: RedisClient<any, any, any, any, any>): void {
    return;
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
    if (this.#creator) {
      ret = ret && this.#creator.client.isReady && this.#creator.client.socketEpoch == this.#creator.epoch
    }

    return ret;
  }
}

// Doesn't clear cache on client disconnect, validates entries on retrieval
export class PooledNoRedirectClientSideCache extends BasicPooledClientSideCache {
  override createValueEntry(client: RedisClient<any, any, any, any, any>, value: any): ClientSideCacheEntryValue {
    const creator = {
      epoch: client.socketEpoch,
      client: client
    };

    return new PooledClientSideCacheEntryValue(this.ttl, creator, value);
  }

  override createPromiseEntry(client: RedisClient<any, any, any, any, any>, sendCommandPromise: Promise<ReplyUnion>): ClientSideCacheEntryPromise {
    const creator = {
      epoch: client.socketEpoch,
      client: client
    };

    return new PooledClientSideCacheEntryPromise(this.ttl, creator, sendCommandPromise);
  }

  override clearOnReconnect(): boolean {
    return false;
  }
}

// Only clears cache on "management"/"redirect" client disconnect
export class PooledRedirectClientSideCache extends PooledClientSideCacheProvider {
  #id?: number;
  #clients: Set<CachingClient> = new Set();
  #disabled = true;
  #redirectClient?: CachingClient;

  constructor(ttl: number, maxEntries: number, lru: boolean) {
    super(ttl, maxEntries, lru);
  }

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

  override trackingOn(): string[] {
    if (this.#id) {
      return ['CLIENT', 'TRACKING', 'ON', 'REDIRECT', this.#id.toString()];
    } else {
      return [];
    }
  }

  override updateRedirect(id: number) {
    this.#id = id;
    for (const client of this.#clients) {
      client.sendCommand(this.trackingOn()).catch(() => {});
    }
  }

  override addClient(client: RedisClient<any, any, any, any, any>) {
    this.#clients.add(client);
  }

  override removeClient(client: RedisClient<any, any, any, any, any>) {
    this.#clients.delete(client);
  }

  override clearOnReconnect(): boolean {
    return false;
  }

  setRedirectClient(client: CachingClient) {
    this.#redirectClient = client;
  }

  destroy() {
    this.clear();

    if (this.#redirectClient) {
      this.#id = undefined;
      const client = this.#redirectClient;
      this.#redirectClient = undefined;

      client.destroy();
    }
  }

  async close() {
    this.clear();

    if (this.#redirectClient) {
      this.#id = undefined;
      const client = this.#redirectClient;
      this.#redirectClient = undefined;

      return client.close();
    }
  }
}