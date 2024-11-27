'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrevrank: Determine the index of a member in a sorted set, with scores ordered from high to low

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zrevrank('myzset', 'one', function (err, res) {
    console.log(res); // 2
});

client.zrevrank('myzset', 'four ', function (err, res) {
    console.log(res); // null
});
