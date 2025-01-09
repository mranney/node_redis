// EXAMPLE: cmds_servermgmt
// REMOVE_START
import assert from 'node:assert';
// REMOVE_END

// HIDE_START
import { createClient } from 'redis';

const client = createClient();
await client.connect().catch(console.error);
// HIDE_END

// STEP_START flushall
// REMOVE_START
await client.set('foo', '1');
await client.set('bar', '2');
await client.set('baz', '3');
// REMOVE_END
const res1 = await client.flushAll('SYNC'); // or ASYNC
console.log(res1); // OK

const res2 = await client.keys('*');
console.log(res2); // []

// REMOVE_START
assert.equal(res1, 'OK');
assert.deepEqual(res2, []);
// REMOVE_END
// STEP_END

// STEP_START info
const res3 = await client.info();
console.log(res3)
// # Server
// redis_version:7.4.0
// redis_git_sha1:c9d29f6a
// redis_git_dirty:0
// redis_build_id:4c367a16e3f9616
// redis_mode:standalone
// ...
// STEP_END

// HIDE_START
await client.quit();
// HIDE_END
