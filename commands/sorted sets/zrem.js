'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrem: Remove one or more members from a sorted set

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zrem('myzset', 'two', function (err, res) {
    console.log(res); // 1
});

client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'one', '1', 'three', '3' ]
});
