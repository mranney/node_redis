'use strict';

var redis = require('redis');
var client = redis.createClient();

// hset: Set the string value of a hash field

client.hset('myhash', 'field1', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.hget('myhash', 'field1', function (err, res) {
    console.log(res); // Hello
});
