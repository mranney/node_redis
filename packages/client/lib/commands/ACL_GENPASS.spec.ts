import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import ACL_GENPASS from './ACL_GENPASS';

describe('ACL GENPASS', () => {
  testUtils.isVersionGreaterThanHook([6]);

  describe('transformArguments', () => {
    it('simple', () => {
      assert.deepEqual(
        ACL_GENPASS.transformArguments(),
        ['ACL', 'GENPASS']
      );
    });

    it('with bits', () => {
      assert.deepEqual(
        ACL_GENPASS.transformArguments(128),
        ['ACL', 'GENPASS', '128']
      );
    });
  });

  testUtils.testWithClient('client.aclGenPass', async client => {
    assert.equal(
      typeof await client.aclGenPass(),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
