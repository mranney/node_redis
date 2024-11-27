'use strict';

var redis = require('redis');
var client = redis.createClient();

// hsetnx: Set the value of a hash field, only if the field does not exist

client.hsetnx('myhash', 'field', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.hsetnx('myhash', 'field', 'Hello', function (err, res) {
    console.log(res); // 0
});

client.hget('myhash', 'field', function (err, res) {
    console.log(res); // Hello
});
