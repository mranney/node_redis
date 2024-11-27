'use strict';

var redis = require('redis');
var client = redis.createClient();

// del: Delete a key

client.set('key1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('key2', 'World', function (err, res) {
    console.log(res); // OK
});

client.del('key1', 'key2','key3', function (err, res) {
    console.log(res); // 2
});

