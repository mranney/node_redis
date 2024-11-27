'use strict';

var redis = require('redis');
var client = redis.createClient();

// zcard: Get the number of members in a sorted set

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zcard('myzset', function (err, res) {
    console.log(res); // 2
});
