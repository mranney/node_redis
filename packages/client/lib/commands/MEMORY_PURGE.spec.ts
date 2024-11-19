import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import MEMORY_PURGE from './MEMORY_PURGE';

describe('MEMORY PURGE', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      MEMORY_PURGE.transformArguments(),
      ['MEMORY', 'PURGE']
    );
  });

  testUtils.testWithClient('client.memoryPurge', async client => {
    assert.equal(
      await client.memoryPurge(),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
