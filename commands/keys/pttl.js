'use strict';

var redis = require('redis');
var client = redis.createClient();

// pttl: Get the time to live for a key in milliseconds

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.expire('mykey', 1, function (err, res) {
    console.log(res); // 1
});

client.pttl('mykey', function (err, res) {
    console.log(res); // 999
});
