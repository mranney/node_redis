import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import LATENCY_DOCTOR from './LATENCY_DOCTOR';

describe('LATENCY DOCTOR', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      LATENCY_DOCTOR.transformArguments(),
      ['LATENCY', 'DOCTOR']
    );
  });

  testUtils.testWithClient('client.latencyDoctor', async client => {
    assert.equal(
      typeof await client.latencyDoctor(),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
