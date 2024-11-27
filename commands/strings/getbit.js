'use strict';

var redis = require('redis');
var client = redis.createClient();

// getbit: Returns the bit value at offset in the string value stored at key

client.setbit('mykey', 7, 1, function (err, res) {
    console.log(res); // 0
});

client.getbit('mykey', 0, function (err, res) {
    console.log(res); // 0
});
