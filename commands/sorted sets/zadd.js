'use strict';

var redis = require('redis');
var client = redis.createClient();

// zadd: Add one or more members to a sorted set, or update its score if it already exists

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 1, 'uno', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', 3, 'three', function (err, res) {
    console.log(res); // 2
});

client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'one', '1', 'uno', '1', 'two', '2', 'three', '3' ]
});
