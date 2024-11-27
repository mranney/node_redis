'use strict';

var redis = require('redis');
var client = redis.createClient();

// touch: Alters the last access time of a key(s). Returns the number of existing keys specified.

client.set('key1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('key2', 'World', function (err, res) {
    console.log(res); // OK
});

client.touch('key1', 'key2', function (err, res) {
    console.log(res); // 2
});
