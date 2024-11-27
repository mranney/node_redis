'use strict';

var redis = require('redis');
var client = redis.createClient();

// setbit: Sets or clears the bit at offset in the string value stored at key

client.setbit('mykey', 7, 1, function (err, res) {
    console.log(res); // 0
});

client.setbit('mykey', 7, 0, function (err, res) {
    console.log(res); // 1
});

client.get('mykey', function (err, res) {
    console.log(res); // '\u0000'
});
