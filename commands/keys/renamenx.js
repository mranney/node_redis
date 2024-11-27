'use strict';

var redis = require('redis');
var client = redis.createClient();

// renamenx: Rename a key, only if the new key does not exist

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('myotherkey', 'World', function (err, res) {
    console.log(res); // OK
});

client.renamenx('mykey', 'myotherkey', function (err, res) {
    console.log(res); // 0
});

client.get('myotherkey', function (err, res) {
    console.log(res); // World
});
