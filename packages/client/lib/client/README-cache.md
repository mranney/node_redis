# Client Side Caching Support

Client Side Caching enables Redis Servers and Clients to work together to enable a client to cache results from command sent to a server and be informed by the server when the cached result is no longer valid.

## Usage

node-redis supports two ways of instantiating client side caching support

Note: Client Side Caching is only supported with RESP3.

### Anonymous Cache

```javascript
const client = createClient({RESP: 3, clientSideCache: {ttl: 0, maxEntries: 0, lru: false}})
```

In this instance, the cache is opaque to the user, and they have no control over it.

### Controllable Cache

```javascript
const ttl = 0, maxEntries = 0, lru = false;
const cache = new BasicClientSideCache(ttl, maxEntries, lru);
const client = createClient({RESP: 3, clientSideCache: cache});
```

In this instance, the user has full control over the cache, as they have access to the cache object.

They can manually invalidate keys

```javascript
cache.invalidate(key);
```

they can clear the entire cache
g
```javascript
cache.clear();
```

as well as get cache metrics

```typescript
const hits: number = cache.cacheHits();
const misses: number = cache.cacheMisses();
```

## Pooled Caching

Similar to individual clients, node-redis also supports caching for its pooled client object, with the cache being able to be instantiated in an anonymous manner or a controllable manner.

### Anonymous Cache

```javascript
const client = createClientPool({RESP: 3}, {clientSideCache: {ttl: 0, maxEntries: 0, lru: false}, minimum: 8});
```

### Controllable Cache

```javascript
const ttl = 0, maxEntries = 0, lru = false;
const cache = new BasicPooledClientSideCache(ttl, maxEntries, lru);
const client = createClientPool({RESP: 3}, {clientSideCache: cache, minimum: 8});
```