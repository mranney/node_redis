// EXAMPLE: string_tutorial
// HIDE_START
import assert from 'assert';
import { createClient } from 'redis';

const client = await createClient();
await client.connect();
// HIDE_END
// REMOVE_START
await client.flushDb();
// REMOVE_END

// STEP_START set
const res1 = await client.set("bike:1", "Deimos");
console.log(res1);  // true
const res2 = await client.get("bike:1");
console.log(res2);  // Deimos
// STEP_END

// REMOVE_START
assert.equal(res1, 'OK');
assert.equal(res2, 'Deimos');
// REMOVE_END

// STEP_START set_nx_xx
// HIDE_START
const res3 = await client.set("bike:1", "bike", 'NX');
console.log(res3);  // None
console.log(await client.get("bike:1"));  // Deimos
const res4 = await client.set("bike:1", "bike", 'XX');
console.log(res4);  // True
// STEP_END

// REMOVE_START
assert.equal(res3, 'OK');
assert.equal(res4, 'OK');
// REMOVE_END

// STEP_START mset
const res5 = await client.mSet([
  ["bike:1", "Deimos"],
  ["bike:2", "Ares"],
  ["bike:3", "Vanth"]
]);

console.log(res5);  // true
const res6 = await client.mGet(["bike:1", "bike:2", "bike:3"]);
console.log(res6);  // ['Deimos', 'Ares', 'Vanth']
// STEP_END

// REMOVE_START
assert.equal(res5, 'OK');
assert.deepEqual(res6, ["Deimos", "Ares", "Vanth"]);
// REMOVE_END

// STEP_START incr
await client.set("total_crashes", 0);
const res7 = await client.incr("total_crashes");
console.log(res7); // 1
const res8 = await client.incrBy("total_crashes", 10);
console.log(res8); // 11
// STEP_END

// REMOVE_START
assert.equal(res7, 1);
assert.equal(res8, 11);
// REMOVE_END

await client.quit();