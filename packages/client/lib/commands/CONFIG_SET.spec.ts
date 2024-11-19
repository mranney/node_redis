import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import CONFIG_SET from './CONFIG_SET';

describe('CONFIG SET', () => {
  describe('transformArguments', () => {
    it('set one parameter (old version)', () => {
      assert.deepEqual(
        CONFIG_SET.transformArguments('parameter', 'value'),
        ['CONFIG', 'SET', 'parameter', 'value']
      );
    });

    it('set muiltiple parameters', () => {
      assert.deepEqual(
        CONFIG_SET.transformArguments({
          1: 'a',
          2: 'b',
          3: 'c'
        }),
        ['CONFIG', 'SET', '1', 'a', '2', 'b', '3', 'c']
      );
    });
  });

  testUtils.testWithClient('client.configSet', async client => {
    assert.equal(
      await client.configSet('lua-time-limit', '5000'),
      'OK'
    );
  }, GLOBAL.SERVERS.OPEN);
});
