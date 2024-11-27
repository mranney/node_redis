'use strict';

var redis = require('redis');
var client = redis.createClient();

// hkeys: Get all the fields in a hash

client.hset('myhash', 'field1', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.hset('myhash', 'field2', 'World', function (err, res) {
    console.log(res); // 1
});

client.hkeys('myhash', function (err, res) {
    console.log(res); // [ 'field1', 'field2' ]
});
