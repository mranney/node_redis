'use strict';

var redis = require('redis');
var client = redis.createClient();

// expire: Set a key's time to live in seconds

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.expire('mykey', 10, function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // 10
});

client.set('mykey', 'Hello world', function (err, res) {
    console.log(res); // OK
});

client.ttl('mykey', function (err, res) {
    console.log(res); // -1
});
