'use strict';

var redis = require('redis');
var client = redis.createClient();

// pexpire: Set a key's time to live in milliseconds

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.pexpire('mykey', 1500, function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // 1
});

client.pttl('mykey', function (err, res) {
    console.log(res); // 1499
});
