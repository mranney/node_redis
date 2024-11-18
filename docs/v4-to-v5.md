# v4 to v5 migration guide

## Client Configuration

### Keep Alive

To better align with Node.js build-in [`net`](https://nodejs.org/api/net.html) and [`tls`](https://nodejs.org/api/tls.html) modules, the `keepAlive` option has been split into 2 options: `keepAlive` (`boolean`) and `keepAliveInitialDelay` (`number`). The defaults remain `true` and `5000`.

### Legacy Mode

In the previous version, you could access "legacy" mode by creating a client and passing in `{ legacyMode: true }`. Now, you can create one off of an existing client by calling the `.legacy()` function. This allows easier access to both APIs and enables better TypeScript support.

```javascript
// use `client` for the current API
const client = createClient();
await client.set('key', 'value');

// use `legacyClient` for the "legacy" API
const legacyClient = client.legacy();
legacyClient.set('key', 'value', (err, reply) => {
  // ...
});
```

## Command Options

In v4, command options are passed as a first optional argument:

```javascript
await client.get('key'); // `string | null`
await client.get(client.commandOptions({ returnBuffers: true }), 'key'); // `Buffer | null`
```

This has a couple of flaws:
1. The argument types are checked in runtime, which is a performance hit.
2. Code suggestions are less readable/usable, due to "function overloading".
3. Overall, "user code" is not as readable as it could be.

### The new API for v5

With the new API, instead of passing the options directly to the commands we use a "proxy client" to store them:

```javascript
await client.get('key'); // `string | null`

const proxyClient = client.withCommandOptions({
  typeMapping: {
    [TYPES.BLOB_STRING]: Buffer
  }
});

await proxyClient.get('key'); // `Buffer | null`
```

for more information, see the [Command Options guide](./command-options.md).

## Quit VS Disconnect

The `QUIT` command has been deprecated in Redis 7.2 and should now also be considered deprecated in Node-Redis. Instead of sending a `QUIT` command to the server, the client can simply close the network connection.

`client.QUIT/quit()` is replaced by `client.close()`. and, to avoid confusion, `client.disconnect()` has been renamed to `client.destroy()`.

## Scan Iterators

Iterator commands like `SCAN`, `HSCAN`, `SSCAN`, and `ZSCAN` return collections of elements (depending on the data type). However, v4 iterators loop over these collections and yield individual items:

```javascript
for await (const key of client.scanIterator()) {
  console.log(key, await client.get(key));
}
```

This mismatch can be awkward and makes "multi-key" commands like `MGET`, `UNLINK`, etc. pointless. So, in v5 the iterators now yield a collection instead of an element:

```javascript
for await (const keys of client.scanIterator()) {
  // we can now meaningfully utilize "multi-key" commands
  console.log(keys, await client.mGet(keys));
}
```

for more information, see the [Scan Iterators guide](./scan-iterators.md).

## Isolation Pool

In v4, `RedisClient` had the ability to create a pool of connections using an "Isolation Pool" on top of the "main" connection. However, there was no way to use the pool without a "main" connection:
```javascript
const client = await createClient()
  .on('error', err => console.error(err))
  .connect();

await client.ping(
  client.commandOptions({ isolated: true })
);
```

In v5 we've extracted this pool logic into its own class—`RedisClientPool`:

```javascript
const pool = await createClientPool()
  .on('error', err => console.error(err))
  .connect();

await pool.ping();
```

See the [pool guide](./pool.md) for more information.

## Cluster 'PING'

in v4, `cluster.ping()` would send the ping command to a random node, in v5, this command is no longer available to the cluster client

## Cluster `MULTI`

In v4, `cluster.multi()` did not support executing commands on replicas, even if they were readonly.

```javascript
// this might execute on a replica, depending on configuration
await cluster.sendCommand('key', true, ['GET', 'key']);

// this always executes on a master
await cluster.multi()
  .addCommand('key', ['GET', 'key'])
  .exec();
```

To support executing commands on replicas, `cluster.multi().addCommand` now requires `isReadonly` as the second argument, which matches the signature of `cluster.sendCommand`:

```javascript
await cluster.multi()
  .addCommand('key', true, ['GET', 'key'])
  .exec();
```

## `MULTI.execAsPipeline()`

```javascript
await client.multi()
  .set('a', 'a')
  .set('b', 'b')
  .execAsPipeline();
```

In older versions, if the socket disconnects during the pipeline execution, i.e. after writing `SET a a` and before `SET b b`, the returned promise is rejected, but `SET b b` will still be executed on the server.

In v5, any unwritten commands (in the same pipeline) will be discarded.

## Commands

### Redis

- `ACL GETUSER`: `selectors`
- `COPY`: `destinationDb` -> `DB`, `replace` -> `REPLACE`, `boolean` -> `number` [^boolean-to-number]
- `CLIENT KILL`: `enum ClientKillFilters` -> `const CLIENT_KILL_FILTERS` [^enum-to-constants]
- `CLUSTER FAILOVER`: `enum FailoverModes` -> `const FAILOVER_MODES` [^enum-to-constants]
- `CLIENT TRACKINGINFO`: `flags` in RESP2 - `Set<string>` -> `Array<string>` (to match RESP3 default type mapping)
- `CLUSTER INFO`:
- `CLUSTER SETSLOT`: `ClusterSlotStates` -> `CLUSTER_SLOT_STATES` [^enum-to-constants]
- `CLUSTER RESET`: the second argument is `{ mode: string; }` instead of `string` [^future-proofing]
- `CLUSTER FAILOVER`: `enum FailoverModes` -> `const FAILOVER_MODES` [^enum-to-constants], the second argument is `{ mode: string; }` instead of `string` [^future-proofing]
- `CLUSTER LINKS`: `createTime` -> `create-time`, `sendBufferAllocated` -> `send-buffer-allocated`, `sendBufferUsed` -> `send-buffer-used` [^map-keys]
- `CLUSTER NODES`, `CLUSTER REPLICAS`, `CLUSTER INFO`: returning the raw `VerbatimStringReply`
- `EXPIRE`: `boolean` -> `number` [^boolean-to-number]
- `EXPIREAT`: `boolean` -> `number` [^boolean-to-number]
- `HSCAN`: `tuples` has been renamed to `entries`
- `HEXISTS`: `boolean` -> `number` [^boolean-to-number]
- `HRANDFIELD_COUNT_WITHVALUES`: `Record<BlobString, BlobString>` -> `Array<{ field: BlobString; value: BlobString; }>` (it can return duplicates).
- `HSETNX`: `boolean` -> `number` [^boolean-to-number]
- `INFO`:
- `LCS IDX`: `length` has been changed to `len`, `matches` has been changed from `Array<{ key1: RangeReply; key2: RangeReply; }>` to `Array<[key1: RangeReply, key2: RangeReply]>`


- `ZINTER`: instead of `client.ZINTER('key', { WEIGHTS: [1] })` use `client.ZINTER({ key: 'key', weight: 1 }])`
- `ZINTER_WITHSCORES`: instead of `client.ZINTER_WITHSCORES('key', { WEIGHTS: [1] })` use `client.ZINTER_WITHSCORES({ key: 'key', weight: 1 }])`
- `ZUNION`: instead of `client.ZUNION('key', { WEIGHTS: [1] })` use `client.ZUNION({ key: 'key', weight: 1 }])`
- `ZUNION_WITHSCORES`: instead of `client.ZUNION_WITHSCORES('key', { WEIGHTS: [1] })` use `client.ZUNION_WITHSCORES({ key: 'key', weight: 1 }])`
- `ZMPOP`: `{ elements: Array<{ member: string; score: number; }>; }` -> `{ members: Array<{ value: string; score: number; }>; }` to match other sorted set commands (e.g. `ZRANGE`, `ZSCAN`)

- `MOVE`: `boolean` -> `number` [^boolean-to-number]
- `PEXPIRE`: `boolean` -> `number` [^boolean-to-number]
- `PEXPIREAT`: `boolean` -> `number` [^boolean-to-number]
- `PFADD`: `boolean` -> `number` [^boolean-to-number]

- `RENAMENX`: `boolean` -> `number` [^boolean-to-number]
- `SETNX`: `boolean` -> `number` [^boolean-to-number]
- `SCAN`, `HSCAN`, `SSCAN`, and `ZSCAN`: `reply.cursor` will not be converted to number to avoid issues when the number is bigger than `Number.MAX_SAFE_INTEGER`. See [here](https://github.com/redis/node-redis/issues/2561).
- `SCRIPT EXISTS`: `Array<boolean>` -> `Array<number>` [^boolean-to-number]
- `SISMEMBER`: `boolean` -> `number` [^boolean-to-number]
- `SMISMEMBER`: `Array<boolean>` -> `Array<number>` [^boolean-to-number]
- `SMOVE`: `boolean` -> `number` [^boolean-to-number]

- `GEOSEARCH_WITH`/`GEORADIUS_WITH`: `GeoReplyWith` -> `GEO_REPLY_WITH` [^enum-to-constants]
- `GEORADIUSSTORE` -> `GEORADIUS_STORE`
- `GEORADIUSBYMEMBERSTORE` -> `GEORADIUSBYMEMBER_STORE`
- `XACK`: `boolean` -> `number` [^boolean-to-number]
- `XADD`: the `INCR` option has been removed, use `XADD_INCR` instead
- `LASTSAVE`: `Date` -> `number` (unix timestamp)
- `HELLO`: `protover` moved from the options object to it's own argument, `auth` -> `AUTH`, `clientName` -> `SETNAME`
- `MODULE LIST`: `version` -> `ver` [^map-keys]
- `MEMORY STATS`: [^map-keys]
- `FUNCTION RESTORE`: the second argument is `{ mode: string; }` instead of `string` [^future-proofing]
- `FUNCTION STATS`: `runningScript` -> `running_script`, `durationMs` -> `duration_ms`, `librariesCount` -> `libraries_count`, `functionsCount` -> `functions_count` [^map-keys]

- `TIME`: `Date` -> `[unixTimestamp: string, microseconds: string]`

- `XGROUP_CREATECONSUMER`: [^boolean-to-number]
- `XGROUP_DESTROY`: [^boolean-to-number]
- `XINFO GROUPS`: `lastDeliveredId` -> `last-delivered-id` [^map-keys]
- `XINFO STREAM`: `radixTreeKeys` -> `radix-tree-keys`, `radixTreeNodes` -> `radix-tree-nodes`, `lastGeneratedId` -> `last-generated-id`, `maxDeletedEntryId` -> `max-deleted-entry-id`, `entriesAdded` -> `entries-added`, `recordedFirstEntryId` -> `recorded-first-entry-id`, `firstEntry` -> `first-entry`, `lastEntry` -> `last-entry`
- `XAUTOCLAIM`, `XCLAIM`, `XRANGE`, `XREVRANGE`: `Array<{ name: string; messages: Array<{ id: string; message: Record<string, string> }>; }>` -> `Record<string, Array<{ id: string; message: Record<string, string> }>>`

- `COMMAND LIST`: `enum FilterBy` -> `const COMMAND_LIST_FILTER_BY` [^enum-to-constants], the filter argument has been moved from a "top level argument" into ` { FILTERBY: { type: <MODULE|ACLCAT|PATTERN>; value: <value> } }`

### Bloom

- `TOPK.QUERY`: `Array<number>` -> `Array<boolean>`

### Graph

- `GRAPH.SLOWLOG`: `timestamp` has been changed from `Date` to `number`

### JSON

- `JSON.ARRINDEX`: `start` and `end` arguments moved to `{ range: { start: number; end: number; }; }` [^future-proofing]
- `JSON.ARRPOP`: `path` and `index` arguments moved to `{ path: string; index: number; }` [^future-proofing]
- `JSON.ARRLEN`, `JSON.CLEAR`, `JSON.DEBUG MEMORY`, `JSON.DEL`, `JSON.FORGET`, `JSON.OBJKEYS`, `JSON.OBJLEN`, `JSON.STRAPPEND`, `JSON.STRLEN`, `JSON.TYPE`: `path` argument moved to `{ path: string; }` [^future-proofing]

### Search

- `FT.SUGDEL`: [^boolean-to-number]
- `FT.CURSOR READ`: `cursor` type changed from `number` to `string` (in and out) to avoid issues when the number is bigger than `Number.MAX_SAFE_INTEGER`. See [here](https://github.com/redis/node-redis/issues/2561).

### Time Series

- `TS.ADD`: `boolean` -> `number` [^boolean-to-number]
- `TS.[M][REV]RANGE`: `enum TimeSeriesBucketTimestamp` -> `const TIME_SERIES_BUCKET_TIMESTAMP` [^enum-to-constants], `enum TimeSeriesReducers` -> `const TIME_SERIES_REDUCERS` [^enum-to-constants], the `ALIGN` argument has been moved into `AGGREGRATION`
- `TS.SYNUPDATE`: `Array<string | Array<string>>` -> `Record<string, Array<string>>`
- `TS.M[REV]RANGE[_WITHLABELS]`, `TS.MGET[_WITHLABELS]`: TODO

[^enum-to-constants]: TODO

[^map-keys]: To avoid unnecessary transformations and confusion, map keys will not be transformed to "js friendly" names (i.e. `number-of-keys` will not be renamed to `numberOfKeys`). See [here](https://github.com/redis/node-redis/discussions/2506).

[^future-proofing]: TODO
