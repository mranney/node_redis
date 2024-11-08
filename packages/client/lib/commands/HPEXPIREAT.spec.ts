import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HPEXPIREAT from './HPEXPIREAT';

describe('HPEXPIREAT', () => {
  testUtils.isVersionGreaterThanHook([7, 4]);
  
  describe('transformArguments', () => {
    it('string + number', () => {
      assert.deepEqual(
        HPEXPIREAT.transformArguments('key', 'field', 1),
        ['HPEXPIREAT', 'key', '1', '1', 'field']
      );
    });

    it('array + number', () => {
      assert.deepEqual(
        HPEXPIREAT.transformArguments('key', ['field1', 'field2'], 1),
        ['HPEXPIREAT', 'key', '1', '2', 'field1', 'field2']
      );
    });

    it('date', () => {
      const d = new Date();
      assert.deepEqual(
        HPEXPIREAT.transformArguments('key', ['field1'], d),
        ['HPEXPIREAT', 'key', d.getTime().toString(), '1', 'field1']
      );
    });

    it('with set option', () => {
      assert.deepEqual(
        HPEXPIREAT.transformArguments('key', ['field1'], 1, 'XX'),
        ['HPEXPIREAT', 'key', '1', 'XX', '1', 'field1']
      );
    });
  });

  testUtils.testAll('hpExpireAt', async client => {
    assert.equal(
      await client.hpExpireAt('key', 'field', 1),
      [-2]
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
