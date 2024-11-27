'use strict';

var redis = require('redis');
var client = redis.createClient();

// setnx: Set the value of a key, only if the key does not exist

client.setnx('mykey', 'Hello', function (err, res) {
    console.log(res); // 0
});

client.setnx('mykey', 'World', function (err, res) {
    console.log(res); // 1
});

client.get('mykey', function (err, res) {
    console.log(res); // Hello
});
