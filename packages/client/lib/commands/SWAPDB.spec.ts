import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import SWAPDB from './SWAPDB';

describe('SWAPDB', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      SWAPDB.transformArguments(0, 1),
      ['SWAPDB', '0', '1']
    );
  });

  testUtils.testWithClient('client.swapDb', async client => {
    assert.equal(
      await client.swapDb(0, 1),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
