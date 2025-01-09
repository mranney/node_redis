// EXAMPLE: cmds_list
// HIDE_START
import assert from 'node:assert';
import { createClient } from 'redis';

const client = createClient();
await client.connect().catch(console.error);
// HIDE_END

// STEP_START lpush
const res1 = await client.lPush('mylist', 'world');
console.log(res1); // 1

const res2 = await client.lPush('mylist', 'hello');
console.log(res2); // 2

const res3 = await client.lRange('mylist', 0, -1);
console.log(res3); // [ 'hello', 'world' ]

// REMOVE_START
assert.deepEqual(res3, [ 'hello', 'world' ]);
await client.del('mylist');
// REMOVE_END
// STEP_END

// STEP_START lrange
const res4 = await client.rPush('mylist', 'one');
console.log(res4); // 1

const res5 = await client.rPush('mylist', 'two');
console.log(res5); // 2

const res6 = await client.rPush('mylist', 'three');
console.log(res6); // 3

const res7 = await client.lRange('mylist', 0, 0);
console.log(res7); // [ 'one' ]

const res8 = await client.lRange('mylist', -3, 2);
console.log(res8); // [ 'one', 'two', 'three' ]

const res9 = await client.lRange('mylist', -100, 100);
console.log(res9); // [ 'one', 'two', 'three' ]

const res10 = await client.lRange('mylist', 5, 10);
console.log(res10); // []

// REMOVE_START
assert.deepEqual(res7, [ 'one' ]);
assert.deepEqual(res8, [ 'one', 'two', 'three' ]);
assert.deepEqual(res9, [ 'one', 'two', 'three' ]);
assert.deepEqual(res10, []);
await client.del('mylist');
// REMOVE_END
// STEP_END

// STEP_START llen
const res11 = await client.lPush('mylist', 'World');
console.log(res11); // 1

const res12 = await client.lPush('mylist', 'Hello');
console.log(res12); // 2

const res13 = await client.lLen('mylist');
console.log(res13); // 2

// REMOVE_START
assert.equal(res13, 2);
await client.del('mylist');
// REMOVE_END
// STEP_END

// STEP_START rpush
const res14 = await client.rPush('mylist', 'hello');
console.log(res14); // 1

const res15 = await client.rPush('mylist', 'world');
console.log(res15); // 2

const res16 = await client.lRange('mylist', 0, -1);
console.log(res16); // [ 'hello', 'world' ]

// REMOVE_START
assert.deepEqual(res16, [ 'hello', 'world' ]);
await client.del('mylist');
// REMOVE_END
// STEP_END

// STEP_START lpop
const res17 = await client.rPush('mylist', ["one", "two", "three", "four", "five"]);
console.log(res17); // 5

const res18 = await client.lPop('mylist');
console.log(res18); // 'one'

const res19 = await client.lPopCount('mylist', 2);
console.log(res19); // [ 'two', 'three' ]

const res20 = await client.lRange('mylist', 0, -1);
console.log(res20); // [ 'four', 'five' ]

// REMOVE_START
assert.deepEqual(res20, [ 'four', 'five' ]);
await client.del('mylist');
// REMOVE_END
// STEP_END

// STEP_START rpop
const res21 = await client.rPush('mylist', ["one", "two", "three", "four", "five"]);
console.log(res21); // 5

const res22 = await client.rPop('mylist');
console.log(res22); // 'five'

const res23 = await client.rPopCount('mylist', 2);
console.log(res23); // [ 'four', 'three' ]

const res24 = await client.lRange('mylist', 0, -1);
console.log(res24); // [ 'one', 'two' ]

// REMOVE_START
assert.deepEqual(res24, [ 'one', 'two' ]);
await client.del('mylist');
// REMOVE_END
// STEP_END

// HIDE_START
await client.quit();
// HIDE_END
