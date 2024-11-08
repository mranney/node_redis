import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HPTTL from './HPTTL';

describe('HPTTL', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);
  
  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HPTTL.transformArguments('key', 'field'),
        ['HPTTL', 'key', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HPTTL.transformArguments('key', ['field1', 'field2']),
        ['HPTTL', 'key', '2', 'field1', 'field2']
      );
    });
  });

  testUtils.testAll('hpTTL', async client => {
    assert.equal(
      await client.hpTTL('key', 'field'),
      [-2]
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
