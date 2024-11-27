'use strict';

var redis = require('redis');
var client = redis.createClient();

// zlexcount: Count the number of members in a sorted set between a given lexicographical range

client.zadd('myzset', 0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e', function (err, res) {
    console.log(res); // 5
});

client.zadd('myzset', 0, 'f', 0, 'g', function (err, res) {
    console.log(res); // 2
});

client.zlexcount('myzset', '-', '+', function (err, res) {
    console.log(res); // 7
});

client.zlexcount('myzset', '[b', '[f', function (err, res) {
    console.log(res); // 5
});
