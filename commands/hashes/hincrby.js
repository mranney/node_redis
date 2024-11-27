'use strict';

var redis = require('redis');
var client = redis.createClient();

// hincrby: Increment the integer value of a hash field by the given number

client.hset('myhash', 'field', 5, function (err, res) {
    console.log(res); // 1
});

client.hincrby('myhash', 'field', 1, function (err, res) {
    console.log(res); // 6
});

client.hincrby('myhash', 'field', -1, function (err, res) {
    console.log(res); // 5
});

client.hincrby('myhash', 'field', -10, function (err, res) {
    console.log(res); // -5
});
