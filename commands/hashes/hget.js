'use strict';

var redis = require('redis');
var client = redis.createClient();

// hget: Get the value of a hash field

client.hset('myhash', 'field1', 'foo', function (err, res) {
    console.log(res); // 1
});

client.hget('myhash', 'field1', function (err, res) {
    console.log(res); // foo
});

client.hget('myhash', 'field2', function (err, res) {
    console.log(res); // null
});
