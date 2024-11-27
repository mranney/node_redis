'use strict';

var redis = require('redis');
var client = redis.createClient();

// hvals: Get all the values in a hash

client.hset('myhash', 'field1', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.hset('myhash', 'field2', 'World', function (err, res) {
    console.log(res); // 1
});

client.hvals('myhash', function (err, res) {
    console.log(res); // [ 'Hello', 'World' ]
});
