import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import ACL_LOG_RESET from './ACL_LOG_RESET';

describe('ACL LOG RESET', () => {
  testUtils.isVersionGreaterThanHook([6]);

  it('transformArguments', () => {
    assert.deepEqual(
      ACL_LOG_RESET.transformArguments(),
      ['ACL', 'LOG', 'RESET']
    );
  });

  testUtils.testWithClient('client.aclLogReset', async client => {
    assert.equal(
      await client.aclLogReset(),
      'OK'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,  
  });
});
