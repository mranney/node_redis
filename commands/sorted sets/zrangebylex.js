'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrange: Return a range of members in a sorted set, by lexicographical range

client.zadd('myzset', 0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e', 0, 'f', 0, 'g', function (err, res) {
    console.log(res); // 7
});

client.zrangebylex('myzset', '-', '[c', function (err, res) {
    console.log(res); // [ 'a', 'b', 'c' ]
});

client.zrangebylex('myzset', '-', '(c', function (err, res) {
    console.log(res); // [ 'a', 'b' ]
});

client.zrangebylex('myzset', '[aaa', '(g', function (err, res) {
    console.log(res); // [ 'b', 'c', 'd', 'e', 'f' ]
});
