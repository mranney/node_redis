'use strict';

var redis = require('redis');
var client = redis.createClient();

// move: Move a key to another database

client.set('key1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('key2', 'World', function (err, res) {
    console.log(res); // OK
});

client.move('key1', '1', function (err, res) {
    console.log(res); // 1
});

client.move('key2', '1', function (err, res) {
    console.log(res); // 1
});
