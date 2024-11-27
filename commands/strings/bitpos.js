'use strict';

var redis = require('redis');
var client = redis.createClient();

// bitpos: Find first bit set or clear in a string

client.set('mykey', '\x00\xff\xf0', function (err, res) {
    console.log(res); // OK
});

client.bitpos('mykey', 1, 0, function (err, res) {
    console.log(res); // 8
});
