import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import CLIENT_UNPAUSE from './CLIENT_UNPAUSE';

describe('CLIENT UNPAUSE', () => {
  testUtils.isVersionGreaterThanHook([6, 2]);

  it('transformArguments', () => {
    assert.deepEqual(
      CLIENT_UNPAUSE.transformArguments(),
      ['CLIENT', 'UNPAUSE']
    );
  });

  testUtils.testWithClient('client.clientUnpause', async client => {
    assert.equal(
      await client.clientUnpause(),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
