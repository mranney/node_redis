import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL } from '../test-utils';
import HELLO from './HELLO';

describe('HELLO', () => {
  testUtils.isVersionGreaterThanHook([6]);

  describe('transformArguments', () => {
    it('simple', () => {
      assert.deepEqual(
        HELLO.transformArguments(),
        ['HELLO']
      );
    });

    it('with protover', () => {
      assert.deepEqual(
        HELLO.transformArguments(3),
        ['HELLO', '3']
      );
    });

    it('with protover, AUTH', () => {
      assert.deepEqual(
        HELLO.transformArguments(3, {
          AUTH: {
            username: 'username',
            password: 'password'
          }
        }),
        ['HELLO', '3', 'AUTH', 'username', 'password']
      );
    });

    it('with protover, SETNAME', () => {
      assert.deepEqual(
        HELLO.transformArguments(3, {
          SETNAME: 'name'
        }),
        ['HELLO', '3', 'SETNAME', 'name']
      );
    });

    it('with protover, AUTH, SETNAME', () => {
      assert.deepEqual(
        HELLO.transformArguments(3, {
          AUTH: {
            username: 'username',
            password: 'password'
          },
          SETNAME: 'name'
        }),
        ['HELLO', '3', 'AUTH', 'username', 'password', 'SETNAME', 'name']
      );
    });
  });

  testUtils.testWithClient('client.hello', async client => {
    const reply = await client.hello();
    assert.equal(reply.server, 'redis');
    assert.equal(typeof reply.version, 'string');
    assert.equal(reply.proto, 2);
    assert.equal(typeof reply.id, 'number');
    if (process.env.REDIS_ENTERPRISE === undefined) {
      assert.equal(reply.mode, 'standalone');
    } else {
      assert.equal(reply.mode, 'cluster');
    }
    assert.equal(reply.role, 'master');
    assert.deepEqual(reply.modules, []);
  }, {
    ...GLOBAL.SERVERS.OPEN,
    minimumDockerVersion: [6, 2],
  });
});
