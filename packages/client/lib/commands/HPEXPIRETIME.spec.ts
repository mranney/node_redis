import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HPEXPIRETIME from './HPEXPIRETIME';

describe('HPEXPIRETIME', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);

  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HPEXPIRETIME.transformArguments('key', 'field'),
        ['HPEXPIRETIME', 'key', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HPEXPIRETIME.transformArguments('key', ['field1', 'field2']),
        ['HPEXPIRETIME', 'key', '2', 'field1', 'field2']
      );
    });
  });

  testUtils.testAll('hpExpireTime', async client => {
    assert.equal(
      await client.hpExpireTime('key', 'field'),
      [-2]
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
