// EXAMPLE: hash_tutorial
// HIDE_START
import assert from 'assert';
import { createClient } from 'redis';

const client = createClient();
await client.connect();
// HIDE_END
//// STEP_START hSet_hGet_hGetAll
const res1 = await client.hSet(
  'bike:1',
  {
    'model': 'Deimos',
    'brand': 'Ergonom',
    'type': 'Enduro bikes',
    'price': 4972,
  },
)
console.log(res1) // 4

const res2 = await client.hGet('bike:1', 'model')
console.log(res2)  // 'Deimos'

const res3 = await client.hGet('bike:1', 'price')
console.log(res3)  // '4972'

const res4 = await client.hGetAll('bike:1')
console.log(res4)  
/*
{
  brand: 'Ergonom',
  model: 'Deimos',
  price: '4972',
  type: 'Enduro bikes'
}
*/
// STEP_END

// REMOVE_START
assert.equal(res1, 4);
assert.equal(res2, 'Deimos');
assert.equal(res3, '4972');
assert.deepEqual(res4, {
  model: 'Deimos',
  brand: 'Ergonom',
  type: 'Enduro bikes',
  price: '4972'
});
// REMOVE_END

// STEP_START hmGet
const res5 = await client.hmGet('bike:1', ['model', 'price'])
console.log(res5)  // ['Deimos', '4972']
// STEP_END

// REMOVE_START
assert.deepEqual(Object.values(res5), ['Deimos', '4972'])
// REMOVE_END

// STEP_START hIncrBy
const res6 = await client.hIncrBy('bike:1', 'price', 100)
console.log(res6)  // 5072
const res7 = await client.hIncrBy('bike:1', 'price', -100)
console.log(res7)  // 4972
// STEP_END

// REMOVE_START
assert.equal(res6, 5072)
assert.equal(res7, 4972)
// REMOVE_END


// STEP_START hIncrBy_hGet_hMget
const res11 = await client.hIncrBy('bike:1:stats', 'rides', 1)
console.log(res11)  // 1
const res12 = await client.hIncrBy('bike:1:stats', 'rides', 1)
console.log(res12)  // 2
const res13 = await client.hIncrBy('bike:1:stats', 'rides', 1)
console.log(res13)  // 3
const res14 = await client.hIncrBy('bike:1:stats', 'crashes', 1)
console.log(res14)  // 1
const res15 = await client.hIncrBy('bike:1:stats', 'owners', 1)
console.log(res15)  // 1
const res16 = await client.hGet('bike:1:stats', 'rides')
console.log(res16)  // 3
const res17 = await client.hmGet('bike:1:stats', ['crashes', 'owners'])
console.log(res17)  // ['1', '1']
// STEP_END

// REMOVE_START
assert.equal(res11, 1);
assert.equal(res12, 2);
assert.equal(res13, 3);
assert.equal(res14, 1);
assert.equal(res15, 1);
assert.equal(res16, '3');
assert.deepEqual(res17, ['1', '1']);
await client.quit();
// REMOVE_END