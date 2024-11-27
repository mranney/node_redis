'use strict';

var redis = require('redis');
var client = redis.createClient();

// zincrby: Increment the score of a member in a sorted set

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zincrby('myzset', 2, 'one', function (err, res) {
    console.log(res); // 3
});

client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
    console.log(res); // [ 'two', '2', 'one', '3' ]
});
