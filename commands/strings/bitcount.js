'use strict';

var redis = require('redis');
var client = redis.createClient();

// bitcount: Count set bits in a string

client.set('mykey', 'foobar', function (err, res) {
    console.log(res); // OK
});

client.bitcount('mykey', function (err, res) {
    console.log(res); // 26
});

client.bitcount('mykey', 0, 0, function (err, res) {
    console.log(res); // 4
});

client.bitcount('mykey', 1, 1, function (err, res) {
    console.log(res); // 6
});
