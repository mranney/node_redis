'use strict';

var redis = require('redis');
var client = redis.createClient();

// zrangebyscore: Return a range of members in a sorted set, by score

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 2, 'two', function (err, res) {
    console.log(res); // 1
});

client.zadd('myzset', 3, 'three', function (err, res) {
    console.log(res); // 1
});

client.zrangebyscore('myzset', 1, 2, function (err, res) {
    console.log(res); // [ 'one', 'two' ]
});

client.zrangebyscore('myzset', '(1', '2', function (err, res) {
    console.log(res); // [ 'two' ]
});

client.zrangebyscore('myzset', '(1', '(2', function (err, res) {
    console.log(res); // []
});
