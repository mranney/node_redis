'use strict';

var redis = require('redis');
var client = redis.createClient();

// sdiffstore: Subtract multiple sets and store the resulting set in a key

client.sadd('key1', 'a', function (err, res) {
    console.log(res); // 1
});

client.sadd('key1', 'b', function (err, res) {
    console.log(res); // 1
});

client.sadd('key1', 'c', function (err, res) {
    console.log(res); // 1
});

client.sadd('key2', 'c', function (err, res) {
    console.log(res); // 1
});

client.sadd('key2', 'd', function (err, res) {
    console.log(res); // 1
});

client.sadd('key2', 'e', function (err, res) {
    console.log(res); // 1
});

client.sdiffstore('key', 'key1', 'key2', function (err, res) {
    console.log(res); // 2
});

client.smembers('key', function (err, res) {
    console.log(res); // [ 'b', 'a' ]
});
