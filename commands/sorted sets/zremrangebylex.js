'use strict';

var redis = require('redis');
var client = redis.createClient();

// zremrangebylex: Remove all members in a sorted set between the given lexicographical range

client.zadd('myzset', 0, 'aaaa', 0, 'b', 0, 'c', 0, 'd', 0, 'e', function (err, res) {
    console.log(res); // 5
});

client.zadd('myzset', 0, 'foo', 0, 'zap', 0, 'zip', 0, 'ALPHA', 0, 'alpha', function (err, res) {
    console.log(res); // 5
});

client.zrange('myzset', 0, -1, function (err, res) {
    console.log(res); // [ 'ALPHA', 'aaaa', 'alpha', 'b', 'c', 'd', 'e', 'foo', 'zap', 'zip' ]
});

client.zremrangebylex('myzset', '[alpha', '[omega', function (err, res) {
    console.log(res); // 6
});

client.zrange('myzset', 0, -1, function (err, res) {
    console.log(res); // [ 'ALPHA', 'aaaa', 'zap', 'zip' ]
});
