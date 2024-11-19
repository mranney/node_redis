import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import LATENCY_GRAPH from './LATENCY_GRAPH';

describe('LATENCY GRAPH', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      LATENCY_GRAPH.transformArguments('command'),
      [
        'LATENCY',
        'GRAPH',
        'command'
      ]
    );
  });

  testUtils.testWithClient('client.latencyGraph', async client => {
    const [,, reply] = await Promise.all([
      client.configSet('latency-monitor-threshold', '1'),
      client.sendCommand(['DEBUG', 'SLEEP', '0.001']),
      client.latencyGraph('command')
    ]);

    assert.equal(typeof reply, 'string');
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
