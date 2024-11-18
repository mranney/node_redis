import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HEXPIRETIME from './HEXPIRETIME';

describe('HEXPIRETIME', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);

  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HEXPIRETIME.transformArguments('key', 'field'),
        ['HEXPIRETIME', 'key', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HEXPIRETIME.transformArguments('key', ['field1', 'field2']),
        ['HEXPIRETIME', 'key', '2', 'field1', 'field2']
      );
    });
  })

  testUtils.testAll('hExpireTime', async client => {
    assert.equal(
      await client.hExpireTime('key', 'field1'),
      null
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
