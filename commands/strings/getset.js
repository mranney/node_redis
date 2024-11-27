'use strict';

var redis = require('redis');
var client = redis.createClient();

// getset: Set the string value of a key and return its old value

client.incr('mycounter', function (err, res) {
    console.log(res); // 1
});

client.getset('mycounter', '0', function (err, res) {
    console.log(res); // 1
});

client.get('mycounter', function (err, res) {
    console.log(res); // 0
});
