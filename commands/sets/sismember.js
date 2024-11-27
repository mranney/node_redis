'use strict';

var redis = require('redis');
var client = redis.createClient();

// sismember: Determine if a given value is a member of a set

client.sadd('myset', 'one', function (err, res) {
    console.log(res); // 1
});

client.sismember('myset', 'one', function (err, res) {
    console.log(res); // 1
});

client.sismember('myset', 'two', function (err, res) {
    console.log(res); // 0
});
