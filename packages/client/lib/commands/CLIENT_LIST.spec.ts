import { strict as assert } from 'node:assert';
import CLIENT_LIST from './CLIENT_LIST';
import testUtils, { GLOBAL } from '../test-utils';

describe('CLIENT LIST', () => {
  describe('transformArguments', () => {
    it('simple', () => {
      assert.deepEqual(
        CLIENT_LIST.transformArguments(),
        ['CLIENT', 'LIST']
      );
    });

    it('with TYPE', () => {
      assert.deepEqual(
        CLIENT_LIST.transformArguments({
          TYPE: 'NORMAL'
        }),
        ['CLIENT', 'LIST', 'TYPE', 'NORMAL']
      );
    });

    it('with ID', () => {
      assert.deepEqual(
        CLIENT_LIST.transformArguments({
          ID: ['1', '2']
        }),
        ['CLIENT', 'LIST', 'ID', '1', '2']
      );
    });
  });

  testUtils.testWithClient('client.clientList', async client => {
    const reply = await client.clientList();
    assert.ok(Array.isArray(reply));
    for (const item of reply) {
      assert.equal(typeof item.id, 'number');
      assert.equal(typeof item.addr, 'string');
      assert.equal(typeof item.fd, 'number');
      assert.equal(typeof item.name, 'string');
      assert.equal(typeof item.age, 'number');
      assert.equal(typeof item.idle, 'number');
      assert.equal(typeof item.flags, 'string');
      assert.equal(typeof item.db, 'number');
      assert.equal(typeof item.sub, 'number');
      assert.equal(typeof item.psub, 'number');
      assert.equal(typeof item.multi, 'number');
      assert.equal(typeof item.obl, 'number');
      assert.equal(typeof item.events, 'string');
      assert.equal(typeof item.cmd, 'string');
      if (process.env.REDIS_ENTERPRISE === undefined) {
        assert.equal(typeof item.qbuf, 'number');
        assert.equal(typeof item.qbufFree, 'number');
        assert.equal(typeof item.oll, 'number');
        assert.equal(typeof item.omem, 'number');
      }
      
      if (testUtils.isVersionGreaterThan([6, 0])) {
        if (process.env.REDIS_ENTERPRISE === undefined) {
          assert.equal(typeof item.argvMem, 'number');
          assert.equal(typeof item.totMem, 'number');
        }
        assert.equal(typeof item.user, 'string');
        
        if (testUtils.isVersionGreaterThan([6, 2])) {
          if (process.env.REDIS_ENTERPRISE === undefined) {
            assert.equal(typeof item.redir, 'number');
          }
          assert.equal(typeof item.laddr, 'string');
          
          if (testUtils.isVersionGreaterThan([7, 0])) {
            if (process.env.REDIS_ENTERPRISE === undefined) {
              assert.equal(typeof item.multiMem, 'number');
            }
            assert.equal(typeof item.resp, 'number');

            if (testUtils.isVersionGreaterThan([7, 0, 3])) {
              assert.equal(typeof item.ssub, 'number');
            }
          }
        }
      }
    }
  }, GLOBAL.SERVERS.OPEN);
});
