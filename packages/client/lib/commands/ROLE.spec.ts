import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import ROLE from './ROLE';

describe('ROLE', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      ROLE.transformArguments(),
      ['ROLE']
    );
  });

  describe('transformReply', () => {
    it('master', () => {
      assert.deepEqual(
        ROLE.transformReply(['master', 3129659, [['127.0.0.1', '9001', '3129242'], ['127.0.0.1', '9002', '3129543']]] as any),
        {
          role: 'master',
          replicationOffest: 3129659,
          replicas: [{
            host: '127.0.0.1',
            port: 9001,
            replicationOffest: 3129242
          }, {
            host: '127.0.0.1',
            port: 9002,
            replicationOffest: 3129543
          }]
        }
      );
    });

    it('replica', () => {
      assert.deepEqual(
        ROLE.transformReply(['slave', '127.0.0.1', 9000, 'connected', 3167038] as any),
        {
          role: 'slave',
          master: {
            host: '127.0.0.1',
            port: 9000
          },
          state: 'connected',
          dataReceived: 3167038
        }
      );
    });

    it('sentinel', () => {
      assert.deepEqual(
        ROLE.transformReply(['sentinel', ['resque-master', 'html-fragments-master', 'stats-master', 'metadata-master']] as any),
        {
          role: 'sentinel',
          masterNames: ['resque-master', 'html-fragments-master', 'stats-master', 'metadata-master']
        }
      );
    });
  });

  testUtils.testWithClient('client.role', async client => {
    const ret = await client.role();
    assert.equal(ret!.role, 'master');
    assert.equal(ret!.replicationOffest, 0);
    if (process.env.REDIS_ENTERPRISE === undefined) {
      assert.deepEqual(ret!.replicas, []);
    } else {
      assert(ret!.replicas.length > 0);
    }
  }, GLOBAL.SERVERS.OPEN);
});
