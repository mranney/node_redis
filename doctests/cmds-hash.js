// EXAMPLE: cmds_hash
// HIDE_START
import assert from 'node:assert';
import { createClient } from 'redis';

const client = createClient();
await client.connect().catch(console.error);
// HIDE_END

// STEP_START hset
const res1 = await client.hSet('myhash', 'field1', 'Hello')
console.log(res1) // 1

const res2 = await client.hGet('myhash', 'field1')
console.log(res2) // Hello

const res3 = await client.hSet(
  'myhash',
  {
    'field2': 'Hi',
    'field3': 'World'
  }
)
console.log(res3) // 2

const res4 = await client.hGet('myhash', 'field2')
console.log(res4) // Hi

const res5 = await client.hGet('myhash', 'field3')
console.log(res5) // World

const res6 = await client.hGetAll('myhash')
console.log(res6)  

// REMOVE_START
assert.equal(res1, 1);
assert.equal(res2, 'Hello');
assert.equal(res3, 2);
assert.equal(res4, 'Hi');
assert.equal(res5, 'World');
assert.deepEqual(res6, {
  field1: 'Hello',
  field2: 'Hi',
  field3: 'World'
});
await client.del('myhash')
// REMOVE_END
// STEP_END

// STEP_START hget
const res7 = await client.hSet('myhash', 'field1', 'foo')
console.log(res7) // 1

const res8 = await client.hGet('myhash', 'field1')
console.log(res8) // foo

const res9 = await client.hGet('myhash', 'field2')
console.log(res9) // null

// REMOVE_START
assert.equal(res7, 1);
assert.equal(res8, 'foo');
assert.equal(res9, null);
await client.del('myhash')
// REMOVE_END
// STEP_END

// STEP_START hgetall
const res10 = await client.hSet(
  'myhash',
  {
    'field1': 'Hello',
    'field2': 'World'
  }
)

const res11 = await client.hGetAll('myhash')
console.log(res11) // [Object: null prototype] { field1: 'Hello', field2: 'World' }

// REMOVE_START
assert.deepEqual(res11, {
  field1: 'Hello',
  field2: 'World'
});
await client.del('myhash')
// REMOVE_END
// STEP_END

// STEP_START hvals
const res12 = await client.hSet(
  'myhash',
  {
    'field1': 'Hello',
    'field2': 'World'
  }
)

const res13 = await client.hVals('myhash')
console.log(res13) // [ 'Hello', 'World' ]

// REMOVE_START
assert.deepEqual(res13, [ 'Hello', 'World' ]);
await client.del('myhash')
// REMOVE_END
// STEP_END

// HIDE_START
await client.quit();
// HIDE_END
