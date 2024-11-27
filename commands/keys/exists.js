'use strict';

var redis = require('redis');
var client = redis.createClient();

// exists: Determine if a key exists

client.set('key1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.exists('key1', function (err, res) {
    console.log(res); // 1
});

client.exists('nosuchkey', function (err, res) {
    console.log(res); // 0
});

client.set('key2', 'world', function (err, res) {
    console.log(res); // OK
});

client.exists('key1','key2','nosuchkey', function (err, res) {
    console.log(res); // 2
});
