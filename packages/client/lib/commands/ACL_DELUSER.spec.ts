import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import ACL_DELUSER from './ACL_DELUSER';

describe('ACL DELUSER', () => {
  testUtils.isVersionGreaterThanHook([6]);

  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        ACL_DELUSER.transformArguments('username'),
        ['ACL', 'DELUSER', 'username']
      );
    });

    it('array', () => {
      assert.deepEqual(
        ACL_DELUSER.transformArguments(['1', '2']),
        ['ACL', 'DELUSER', '1', '2']
      );
    });
  });

  testUtils.testWithClient('client.aclDelUser', async client => {
    assert.equal(
      typeof await client.aclDelUser('user'),
      'number'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
