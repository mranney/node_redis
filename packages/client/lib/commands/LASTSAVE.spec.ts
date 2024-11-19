import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import LASTSAVE from './LASTSAVE';

describe('LASTSAVE', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      LASTSAVE.transformArguments(),
      ['LASTSAVE']
    );
  });

  testUtils.testWithClient('client.lastSave', async client => {
    assert.equal(
      typeof await client.lastSave(),
      'number'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
