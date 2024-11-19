import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import BGSAVE from './BGSAVE';

describe('BGSAVE', () => {
  describe('transformArguments', () => {
    it('simple', () => {
      assert.deepEqual(
        BGSAVE.transformArguments(),
        ['BGSAVE']
      );
    });

    it('with SCHEDULE', () => {
      assert.deepEqual(
        BGSAVE.transformArguments({
          SCHEDULE: true
        }),
        ['BGSAVE', 'SCHEDULE']
      );
    });
  });

  testUtils.testWithClient('client.bgSave', async client => {
    assert.equal(
      typeof await client.bgSave({
        SCHEDULE: true // using `SCHEDULE` to make sure it won't throw an error
      }),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
