import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import BGREWRITEAOF from './BGREWRITEAOF';

describe('BGREWRITEAOF', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      BGREWRITEAOF.transformArguments(),
      ['BGREWRITEAOF']
    );
  });

  testUtils.testWithClient('client.bgRewriteAof', async client => {
    assert.equal(
      typeof await client.bgRewriteAof(),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
