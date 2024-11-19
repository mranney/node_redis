import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import MEMORY_MALLOC_STATS from './MEMORY_MALLOC-STATS';

describe('MEMORY MALLOC-STATS', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      MEMORY_MALLOC_STATS.transformArguments(),
      ['MEMORY', 'MALLOC-STATS']
    );
  });

  testUtils.testWithClient('client.memoryMallocStats', async client => {
    assert.equal(
      typeof (await client.memoryMallocStats()),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
