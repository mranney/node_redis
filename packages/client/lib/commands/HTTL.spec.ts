import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HTTL from './HTTL';

describe('HTTL', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);
  
  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HTTL.transformArguments('key', 'field'),
        ['TTL', 'key', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HTTL.transformArguments('key', ['field1', 'field2']),
        ['TTL', 'key', '2', 'field1', 'field2']
      );
    });
  
  });

  testUtils.testAll('hTTL', async client => {
    assert.equal(
      await client.hTTL('key', 'field1'),
      null
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
