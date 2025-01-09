// EXAMPLE: cmds_set
// REMOVE_START
import assert from 'node:assert';
// REMOVE_END

// HIDE_START
import { createClient } from 'redis';

const client = createClient();
await client.connect().catch(console.error);
// HIDE_END

// STEP_START sadd
const res1 = await client.sAdd('myset', ['Hello', 'World']);
console.log(res1);  // 2

const res2 = await client.sAdd('myset', ['World']);
console.log(res2);  // 0

const res3 = await client.sMembers('myset')
console.log(res3);  // ['Hello', 'World']

// REMOVE_START
assert.deepEqual(res3, ['Hello', 'World']);
await client.del('myset');
// REMOVE_END
// STEP_END

// STEP_START smembers
const res4 = await client.sAdd('myset', ['Hello', 'World']);
console.log(res4);  // 2

const res5 = await client.sMembers('myset')
console.log(res5);  // ['Hello', 'World']

// REMOVE_START
assert.deepEqual(res5, ['Hello', 'World']);
await client.del('myset');
// REMOVE_END
// STEP_END

// HIDE_START
await client.quit();
// HIDE_END
