'use strict';

var redis = require('redis');
var client = redis.createClient();

// persist: Remove the expiration from a key

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.expire('mykey', 10, function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // 10
});

client.persist('mykey', function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // -1
});
