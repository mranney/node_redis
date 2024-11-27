'use strict';

var redis = require('redis');
var client = redis.createClient();

// zscore: Get the score associated with the given member in a sorted set

client.zadd('myzset', 1, 'one', function (err, res) {
    console.log(res); // 1
});

client.zscore('myzset', 'one', function (err, res) {
    console.log(res); // 1
});
