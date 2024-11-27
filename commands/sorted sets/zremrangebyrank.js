'use strict';

var redis = require('redis');
var client = redis.createClient();

// zremrangebyrank: Remove all members in a sorted set within the given indexes

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zremrangebyrank('myzset', 0,1, function (err, res) {
    console.log(res); // 2
});

client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'three', '3' ]
});
