'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrange: Return a range of members in a sorted set, by index

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zrange('myzset', 0, -1, function (err, res) {
    console.log(res); // [ 'one', 'two', 'three' ]
});

client.zrange('myzset', 2, 3, function (err, res) {
    console.log(res); // [ 'three' ]
});

client.zrange('myzset', -2, -1, function (err, res) {
    console.log(res); // [ 'two', 'three' ]
});
