import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import LATENCY_HISTORY from './LATENCY_HISTORY';

describe('LATENCY HISTORY', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      LATENCY_HISTORY.transformArguments('command'),
      ['LATENCY', 'HISTORY', 'command']
    );
  });

  testUtils.testWithClient('client.latencyHistory', async client => {
    const [,, reply] = await Promise.all([
      client.configSet('latency-monitor-threshold', '100'),
      client.sendCommand(['DEBUG', 'SLEEP', '1']),
      client.latencyHistory('command')
    ]);

    assert.ok(Array.isArray(reply));
    for (const [timestamp, latency] of reply) {
      assert.equal(typeof timestamp, 'number');
      assert.equal(typeof latency, 'number');
    }
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
