import { strict as assert } from 'node:assert';
import CLIENT_INFO from './CLIENT_INFO';
import testUtils, { GLOBAL } from '../test-utils';

describe('CLIENT INFO', () => {
  testUtils.isVersionGreaterThanHook([6, 2]);

  it('transformArguments', () => {
    assert.deepEqual(
      CLIENT_INFO.transformArguments(),
      ['CLIENT', 'INFO']
    );
  });

  testUtils.testWithClient('client.clientInfo', async client => {
    //id=6463001000 addr=5.29.235.17:51462 laddr=10.0.1.6:19664 fd=171 name= age=3 idle=0 flags=N db=0 sub=0 psub=0 
    //ssub=0 multi=-1 watch=0 obl=0 events=r cmd=client|list user=default resp=2 lib-name= lib-ver=

    const reply = await client.clientInfo();
    assert.equal(typeof reply.id, 'number');
    assert.equal(typeof reply.addr, 'string');
    assert.equal(typeof reply.laddr, 'string');
    assert.equal(typeof reply.fd, 'number');
    assert.equal(typeof reply.name, 'string');
    assert.equal(typeof reply.age, 'number');
    assert.equal(typeof reply.idle, 'number');
    assert.equal(typeof reply.flags, 'string');
    assert.equal(typeof reply.db, 'number');
    assert.equal(typeof reply.sub, 'number');
    assert.equal(typeof reply.psub, 'number');
    assert.equal(typeof reply.multi, 'number');   
    assert.equal(typeof reply.obl, 'number');
    assert.equal(typeof reply.events, 'string');
    assert.equal(typeof reply.cmd, 'string');
    assert.equal(typeof reply.user, 'string');
    if (process.env.REDIS_ENTERPRISE === undefined) {
      assert.equal(typeof reply.qbuf, 'number');
      assert.equal(typeof reply.qbufFree, 'number');
      assert.equal(typeof reply.argvMem, 'number');
      assert.equal(typeof reply.oll, 'number');
      assert.equal(typeof reply.omem, 'number');
      assert.equal(typeof reply.totMem, 'number');
      assert.equal(typeof reply.redir, 'number');
    }

    if (testUtils.isVersionGreaterThan([7, 0])) {
      if (process.env.REDIS_ENTERPRISE === undefined) {
        assert.equal(typeof reply.multiMem, 'number');
      }
      assert.equal(typeof reply.resp, 'number');

      if (testUtils.isVersionGreaterThan([7, 0, 3])) {
        assert.equal(typeof reply.ssub, 'number');
      }
    }
  }, GLOBAL.SERVERS.OPEN);
});
