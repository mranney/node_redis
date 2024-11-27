'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrevrangebylex: Return a range of members in a sorted set, by lexicographical range, ordered from higher to lower strings.

client.zadd('myzset', 0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e', 0, 'f', 0, 'g', function (err, res) {
    console.log(res); // 7
});

client.zrevrangebylex('myzset', '[c', '-', function (err, res) {
    console.log(res); // [ 'c', 'b', 'a' ]
});

client.zrevrangebylex('myzset', '(c', '-', function (err, res) {
    console.log(res); // [ 'b', 'a' ]
});

client.zrevrangebylex('myzset', '(g', '[aaa', function (err, res) {
    console.log(res); // [ 'f', 'e', 'd', 'c', 'b' ]
});
