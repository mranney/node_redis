'use strict';

var redis = require('redis');
var client = redis.createClient();

// zinterstore: Intersect multiple sorted sets and store the resulting sorted set in a new key

client.zadd('zset1', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('zset1', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('zset2', 2, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('zset2', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('zset2', 2, 'three', function (err, res) {
    console.log(res); // 1
});

client.zinterstore('out', 2, 'zset1', 'zset2', 'WEIGHTS', 2, 3, function (err, res) {
    console.log(res); // 2
});

client.zrange('out', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'one', '8', 'two', '10' ]
});
