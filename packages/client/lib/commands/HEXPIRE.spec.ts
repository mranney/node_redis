import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HEXPIRE from './HEXPIRE';

describe('HEXPIRE', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);
  
  describe('transformArguments', () => {
    it('string', () => {
      assert.deepEqual(
        HEXPIRE.transformArguments('key', 'field', 1),
        ['HEXPIRE', 'key', '1', '1', 'field']
      );
    });

    it('array', () => {
      assert.deepEqual(
        HEXPIRE.transformArguments('key', ['field1', 'field2'], 1),
        ['HEXPIRE', 'key', '1', '2', 'field1', 'field2']
      );
    });

    it('with set option', () => {
      assert.deepEqual(
        HEXPIRE.transformArguments('key', 'field1', 1, 'NX'),
        ['HEXPIRE', 'key', '1', 'NX', '1', 'field1']
      );
    });
  });

  testUtils.testAll('hexpire', async client => {
    assert.equal(
      await client.hExpire('key', ['field1'], 0),
      null,
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
