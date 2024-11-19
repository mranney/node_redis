import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import ACL_LOG from './ACL_LOG';

describe('ACL LOG', () => {
  testUtils.isVersionGreaterThanHook([6]);

  describe('transformArguments', () => {
    it('simple', () => {
      assert.deepEqual(
        ACL_LOG.transformArguments(),
        ['ACL', 'LOG']
      );
    });

    it('with count', () => {
      assert.deepEqual(
        ACL_LOG.transformArguments(10),
        ['ACL', 'LOG', '10']
      );
    });
  });

  testUtils.testWithClient('client.aclLog', async client => {
    // make sure to create one log
    await assert.rejects(
      client.auth({
        username: 'incorrect',
        password: 'incorrect'
      })
    );

    const logs = await client.aclLog();
    assert.ok(Array.isArray(logs));
    for (const log of logs) {
      assert.equal(typeof log.count, 'number');
      assert.equal(typeof log.reason, 'string');
      assert.equal(typeof log.context, 'string');
      assert.equal(typeof log.object, 'string');
      assert.equal(typeof log.username, 'string');
      assert.equal(typeof log['age-seconds'], 'number');
      assert.equal(typeof log['client-info'], 'string');
      if (testUtils.isVersionGreaterThan([7, 2])) {
        assert.equal(typeof log['entry-id'], 'number');
        assert.equal(typeof log['timestamp-created'], 'number');
        assert.equal(typeof log['timestamp-last-updated'], 'number');
      }
    }
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
