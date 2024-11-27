'use strict';

var redis = require('redis');
var client = redis.createClient();

// setrange: Overwrite part of a string at key starting at the specified offset

client.set('key1', 'Hello World', function (err, res) {
    console.log(res); // OK
});

client.setrange('key1', 6, 'Redis', function (err, res) {
    console.log(res); // 11
});

client.get('key1', function (err, res) {
    console.log(res); // 'Hello Redis'
});

// Example of zero padding:

client.setrange('key2', 6, 'Redis', function (err, res) {
    console.log(res); // 11
});

client.get('key2', function (err, res) {
    console.log(res); // '      Redis'
});
