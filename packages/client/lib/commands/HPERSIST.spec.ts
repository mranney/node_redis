import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HPERSIST from './HPERSIST';

describe('HPERSIST', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);
  
  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HPERSIST.transformArguments('key', 'field'),
        ['HPERSIST', 'key', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HPERSIST.transformArguments('key', ['field1', 'field2']),
        ['HPERSIST', 'key', '2', 'field1', 'field2']
      );
    });
  })

  testUtils.testAll('hPersist', async client => {
    assert.equal(
      await client.hPersist('key', 'field'),
      [-2]
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
