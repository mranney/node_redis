'use strict';

var redis = require('redis');
var client = redis.createClient();

// psetex: Set the value and expiration in milliseconds of a key

client.psetex('mykey', 1000, 'Hello', function (err, res) {
    console.log(res); // OK
});

client.pttl('mykey', function (err, res) {
    console.log(res); // 999
});

client.get('mykey', function (err, res) {
    console.log(res); // Hello
});
