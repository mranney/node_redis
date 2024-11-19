import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import MEMORY_STATS from './MEMORY_STATS';

describe('MEMORY STATS', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      MEMORY_STATS.transformArguments(),
      ['MEMORY', 'STATS']
    );
  });

  testUtils.testWithClient('client.memoryStats', async client => {
    const memoryStats = await client.memoryStats();
    assert.equal(typeof memoryStats['peak.allocated'], 'number');
    assert.equal(typeof memoryStats['total.allocated'], 'number');
    assert.equal(typeof memoryStats['startup.allocated'], 'number');
    assert.equal(typeof memoryStats['replication.backlog'], 'number');
    assert.equal(typeof memoryStats['clients.slaves'], 'number');
    assert.equal(typeof memoryStats['clients.normal'], 'number');
    assert.equal(typeof memoryStats['aof.buffer'], 'number');
    assert.equal(typeof memoryStats['lua.caches'], 'number');
    assert.equal(typeof memoryStats['overhead.total'], 'number');
    assert.equal(typeof memoryStats['keys.count'], 'number');
    assert.equal(typeof memoryStats['keys.bytes-per-key'], 'number');
    assert.equal(typeof memoryStats['dataset.bytes'], 'number');
    assert.equal(typeof memoryStats['dataset.percentage'], 'string');
    assert.equal(typeof memoryStats['peak.percentage'], 'string');
    assert.equal(typeof memoryStats['allocator.allocated'], 'number');
    assert.equal(typeof memoryStats['allocator.active'], 'number');
    assert.equal(typeof memoryStats['allocator.resident'], 'number');
    assert.equal(typeof memoryStats['allocator-fragmentation.ratio'], 'string');
    assert.equal(typeof memoryStats['allocator-fragmentation.bytes'], 'number');
    assert.equal(typeof memoryStats['allocator-rss.ratio'], 'string');
    assert.equal(typeof memoryStats['allocator-rss.bytes'], 'number');
    assert.equal(typeof memoryStats['rss-overhead.ratio'], 'string');
    assert.equal(typeof memoryStats['rss-overhead.bytes'], 'number');
    assert.equal(typeof memoryStats['fragmentation'], 'string');
    assert.equal(typeof memoryStats['fragmentation.bytes'], 'number');
    
    if (testUtils.isVersionGreaterThan([7])) {
      assert.equal(typeof memoryStats['cluster.links'], 'number');
      assert.equal(typeof memoryStats['functions.caches'], 'number');
    }
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
