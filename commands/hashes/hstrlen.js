'use strict';

var redis = require('redis');
var client = redis.createClient();

// hstrlen: Get the length of the value of a hash field

client.hmset('myhash', 'f1', 'HelloWorld', 'f2', 99, 'f3', -256, function (err, res) {
    console.log(res); // OK
});

client.hstrlen('myhash', 'f1', function (err, res) {
    console.log(res); // 10
});

client.hstrlen('myhash', 'f2', function (err, res) {
    console.log(res); // 2
});

client.hstrlen('myhash', 'f3', function (err, res) {
    console.log(res); // 4
});
