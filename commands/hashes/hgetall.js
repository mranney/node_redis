'use strict';

var redis = require('redis');
var client = redis.createClient();

// hgetall: Get all the fields and values in a hash

client.hset('myhash', 'field1', 'hello', function (err, res) {
    console.log(res); // 1
});

client.hset('myhash', 'field2', 'world', function (err, res) {
    console.log(res); // 1
});

client.hgetall('myhash', function (err, res) {
    console.log(res); // { field1: 'hello', field2: 'world' }
});
