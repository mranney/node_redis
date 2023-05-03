import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import OBJECT_IDLETIME from './OBJECT_IDLETIME';

describe('OBJECT IDLETIME', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      OBJECT_IDLETIME.transformArguments('key'),
      ['OBJECT', 'IDLETIME', 'key']
    );
  });

  testUtils.testAll('client.objectIdleTime', async client => {
    assert.equal(
      await client.objectIdleTime('key'),
      null
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
