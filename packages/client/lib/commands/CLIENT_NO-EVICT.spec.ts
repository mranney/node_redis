import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import CLIENT_NO_EVICT from './CLIENT_NO-EVICT';

describe('CLIENT NO-EVICT', () => {
  testUtils.isVersionGreaterThanHook([7]);

  describe('transformArguments', () => {
    it('true', () => {
      assert.deepEqual(
        CLIENT_NO_EVICT.transformArguments(true),
        ['CLIENT', 'NO-EVICT', 'ON']
      );
    });

    it('false', () => {
      assert.deepEqual(
        CLIENT_NO_EVICT.transformArguments(false),
        ['CLIENT', 'NO-EVICT', 'OFF']
      );
    });
  });

  testUtils.testWithClient('client.clientNoEvict', async client => {
    assert.equal(
      await client.clientNoEvict(true),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
