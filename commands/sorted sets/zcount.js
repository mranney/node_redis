'use strict';

var redis = require('redis');
var client = redis.createClient();

// zcount: Count the members in a sorted set with scores within the given values

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zcount('myzset', 1, 3, function (err, res) {
    console.log(res); // 3
});
