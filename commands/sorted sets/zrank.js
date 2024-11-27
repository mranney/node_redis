'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrank: Determine the index of a member in a sorted set

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zrank('myzset', 'three', function (err, res) {
    console.log(res); // 2
});

client.zrank('myzset', 'four', function (err, res) {
    console.log(res); // null
});
