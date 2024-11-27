'use strict';

var redis = require('redis');
var client = redis.createClient();

// bitop: Perform bitwise operations between strings

client.set('key1', 'foobar', function (err, res) {
    console.log(res); // OK
});

client.set('key2', 'abcdef', function (err, res) {
    console.log(res); // OK
});

client.bitop('AND', 'dest', 'key1', 'key2', function (err, res) {
    console.log(res); // 6
});

client.get('dest', function (err, res) {
    console.log(res); // `bc`ab
});
