import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import MEMORY_DOCTOR from './MEMORY_DOCTOR';

describe('MEMORY DOCTOR', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      MEMORY_DOCTOR.transformArguments(),
      ['MEMORY', 'DOCTOR']
    );
  });

  testUtils.testWithClient('client.memoryDoctor', async client => {
    assert.equal(
      typeof (await client.memoryDoctor()),
      'string'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    redisEnterpriseNotSupported: true,
  });
});
