import assert from "assert";
import testUtils, { GLOBAL } from "../test-utils"
import { BasicClientSideCache, BasicPooledClientSideCache } from "./cache"
import { REDIS_FLUSH_MODES } from "../commands/FLUSHALL";
import { once } from 'events';

describe("Client Side Cache", () => {
  describe('Basic Cache', () => {
    const csc = new BasicClientSideCache({ maxEntries: 10 });

    /* cacheNotEmpty */
    testUtils.testWithClient('Basic Cache Miss', async client => {
      csc.clear();

      await client.set("x", 1);
      await client.get("x");

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    /* cacheUsedTest */
    testUtils.testWithClient('Basic Cache Hit', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');
      assert.equal(await client.get("x"), '1');

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 1, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('Max Cache Entries', async client => {
      csc.clear();

      await client.set('1', 1);
      assert.equal(await client.get('1'), '1');
      assert.equal(await client.get('2'), null);
      assert.equal(await client.get('3'), null);
      assert.equal(await client.get('4'), null);
      assert.equal(await client.get('5'), null);
      assert.equal(await client.get('6'), null);
      assert.equal(await client.get('7'), null);
      assert.equal(await client.get('8'), null);
      assert.equal(await client.get('9'), null);
      assert.equal(await client.get('10'), null);
      assert.equal(await client.get('11'), null);
      assert.equal(await client.get('1'), '1');

      assert.equal(csc.cacheMisses(), 12, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('LRU works correctly', async client => {
      csc.clear();

      await client.set('1', 1);
      assert.equal(await client.get('1'), '1');
      assert.equal(await client.get('2'), null);
      assert.equal(await client.get('3'), null);
      assert.equal(await client.get('4'), null);
      assert.equal(await client.get('5'), null);
      assert.equal(await client.get('1'), '1');
      assert.equal(await client.get('6'), null);
      assert.equal(await client.get('7'), null);
      assert.equal(await client.get('8'), null);
      assert.equal(await client.get('9'), null);
      assert.equal(await client.get('10'), null);
      assert.equal(await client.get('11'), null);
      assert.equal(await client.get('1'), '1');

      assert.equal(csc.cacheMisses(), 11, "Cache Misses");
      assert.equal(csc.cacheHits(), 2, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('Basic Cache Clear', async client => {
      csc.clear();

      await client.set("x", 1);
      await client.get("x");
      csc.clear();
      await client.get("x");

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('Null Invalidate acts as clear', async client => {
      csc.clear();

      await client.set("x", 1);
      await client.get("x");
      csc.invalidate(null);
      await client.get("x");

      assert.equal(2, csc.cacheMisses(), "Cache Misses");
      assert.equal(0, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('flushdb causes an invalidate null', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');
      await client.flushDb(REDIS_FLUSH_MODES.SYNC);
      assert.equal(await client.get("x"), null);

      assert.equal(csc.cacheMisses(), 2, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    testUtils.testWithClient('Basic Cache Invalidate', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1', 'first get');
      await client.set("x", 2);
      assert.equal(await client.get("x"), '2', 'second get');
      await client.set("x", 3);
      assert.equal(await client.get("x"), '3', 'third get');

      assert.equal(csc.cacheMisses(), 3, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    /* immutableCacheEntriesTest */
    testUtils.testWithClient("Cached Replies Don't Mutate", async client => {
      csc.clear();

      await client.set("x", 1);
      await client.set('y', 2);
      const ret1 = await client.mGet(['x', 'y']);
      assert.deepEqual(ret1, ['1', '2'], 'first mGet');
      ret1[0] = '4';
      const ret2 = await client.mGet(['x', 'y']);
      assert.deepEqual(ret2, ['1', '2'], 'second mGet');
      ret2[0] = '8';
      const ret3 = await client.mGet(['x', 'y']);
      assert.deepEqual(ret3, ['1', '2'], 'third mGet');

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 2, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    /* clearOnDisconnectTest */
    testUtils.testWithClient("Cached cleared on disconnect", async client => {
      csc.clear();

      await client.set("x", 1);
      await client.set('y', 2);
      const ret1 = await client.mGet(['x', 'y']);
      assert.deepEqual(ret1, ['1', '2'], 'first mGet');

      assert.equal(csc.cacheMisses(), 1, "first Cache Misses");
      assert.equal(csc.cacheHits(), 0, "first Cache Hits");

      await client.close();

      await client.connect();

      const ret2 = await client.mGet(['x', 'y']);
      assert.deepEqual(ret2, ['1', '2'], 'second mGet');

      assert.equal(csc.cacheMisses(), 1, "second Cache Misses");
      assert.equal(csc.cacheHits(), 0, "second Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });
  });

  describe("Pooled Cache", () => {
    const csc = new BasicPooledClientSideCache();

    testUtils.testWithClient('Virtual Pool Disconnect', async client1 => {
      const client2 = client1.duplicate();
      await client2.connect()

      assert.equal(await client2.get("x"), null);
      assert.equal(await client1.get("x"), null);

      assert.equal(1, csc.cacheMisses(), "Cache Misses");
      assert.equal(1, csc.cacheHits(), "Cache Hits");

      await client2.close();

      assert.equal(await client1.get("x"), null);
      assert.equal(await client1.get("x"), null);

      assert.equal(2, csc.cacheMisses(), "Cache Misses");
      assert.equal(2, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
        clientSideCache: csc
      }
    });

    /* cacheNotEmpty */
    testUtils.testWithClientPool('Basic Cache Miss and Clear', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');

      assert.equal(1, csc.cacheMisses(), "Cache Misses");
      assert.equal(0, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
      },
      poolOptions: {
        minimum: 5,
        maximum: 5,
        acquireTimeout: 0,
        cleanupDelay: 1,
        clientSideCache: csc
      }
    })

    /* cacheUsedTest */
    testUtils.testWithClientPool('Basic Cache Hit', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');
      assert.equal(await client.get("x"), '1');
      assert.equal(await client.get("x"), '1');

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 2, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
      },
      poolOptions: {
        minimum: 5,
        maximum: 5,
        acquireTimeout: 0,
        cleanupDelay: 1,
        clientSideCache: csc
      }
    })

    /* invalidationTest 1 */
    testUtils.testWithClientPool('Basic Cache Manually Invalidate', async client => {
      csc.clear();

      await client.set("x", 1);

      assert.equal(await client.get("x"), '1', 'first get');

      let p: Promise<Array<string>> = once(csc, 'invalidate');
      await client.set("x", 2);
      let [i] = await p;

      assert.equal(await client.get("x"), '2', 'second get');

      p = once(csc, 'invalidate');
      await client.set("x", 3);
      [i] = await p;

      assert.equal(await client.get("x"), '3');

      assert.equal(csc.cacheMisses(), 3, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
      },
      poolOptions: {
        minimum: 5,
        maximum: 5,
        acquireTimeout: 0,
        cleanupDelay: 1,
        clientSideCache: csc
      }
    })

    /* invalidationTest 2 */
    testUtils.testWithClientPool('Basic Cache Invalidate via message', async client => {
      csc.clear();

      await client.set('x', 1);
      await client.set('y', 2);

      assert.deepEqual(await client.mGet(['x', 'y']), ['1', '2'], 'first mGet');

      assert.equal(csc.cacheMisses(), 1, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");

      let p: Promise<Array<string>> = once(csc, 'invalidate');
      await client.set("x", 3);
      let [i] = await p;

      assert.equal(i, 'x');

      assert.deepEqual(await client.mGet(['x', 'y']), ['3', '2'], 'second mGet');

      assert.equal(csc.cacheMisses(), 2, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");

      p = once(csc, 'invalidate');
      await client.set("y", 4);
      [i] = await p;

      assert.equal(i, 'y');

      assert.deepEqual(await client.mGet(['x', 'y']), ['3', '4'], 'second mGet');

      assert.equal(csc.cacheMisses(), 3, "Cache Misses");
      assert.equal(csc.cacheHits(), 0, "Cache Hits");
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        RESP: 3,
      },
      poolOptions: {
        minimum: 5,
        maximum: 5,
        acquireTimeout: 0,
        cleanupDelay: 1,
        clientSideCache: csc
      }
    })
  });

  describe('Cluster Caching', () => {
    const csc = new BasicPooledClientSideCache();

    testUtils.testWithCluster('Basic Cache Miss and Clear', async client => {
      csc.clear();

      await client.set("x", 1);
      await client.get("x");
      await client.set("y", 1);
      await client.get("y");

      assert.equal(2, csc.cacheMisses(), "Cache Misses");
      assert.equal(0, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.CLUSTERS.OPEN,
      clusterConfiguration: {
        RESP: 3,
        clientSideCache: csc
      }
    })

    testUtils.testWithCluster('Basic Cache Hit', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');
      assert.equal(await client.get("x"), '1');
      assert.equal(await client.get("x"), '1');
      await client.set("y", 1);
      assert.equal(await client.get("y"), '1');
      assert.equal(await client.get("y"), '1');
      assert.equal(await client.get("y"), '1');

      assert.equal(2, csc.cacheMisses(), "Cache Misses");
      assert.equal(4, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.CLUSTERS.OPEN,
      clusterConfiguration: {
        RESP: 3,
        clientSideCache: csc
      }
    })

    testUtils.testWithCluster('Basic Cache Invalidate', async client => {
      csc.clear();

      await client.set("x", 1);
      assert.equal(await client.get("x"), '1');
      await client.set("x", 2);
      assert.equal(await client.get("x"), '2');
      await client.set("x", 3);
      assert.equal(await client.get("x"), '3');

      await client.set("y", 1);
      assert.equal(await client.get("y"), '1');
      await client.set("y", 2);
      assert.equal(await client.get("y"), '2');
      await client.set("y", 3);
      assert.equal(await client.get("y"), '3');

      assert.equal(6, csc.cacheMisses(), "Cache Misses");
      assert.equal(0, csc.cacheHits(), "Cache Hits");
    }, {
      ...GLOBAL.CLUSTERS.OPEN,
      clusterConfiguration: {
        RESP: 3,
        clientSideCache: csc
      }
    })
  });
});