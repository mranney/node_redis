'use strict';

var redis = require('redis');
var client = redis.createClient();

// zremrangebyscore: Remove all members in a sorted set within the given scores

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zremrangebyscore('myzset', '-inf' ,'(2', function (err, res) {
    console.log(res); // 1
});

client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'two', '2', 'three', '3' ]
});
