'use strict';

var redis = require('redis');
var client = redis.createClient();

// scard: Get the number of members in a set

client.sadd('mykey', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.sadd('mykey', 'World', function (err, res) {
    console.log(res); // 1
});

client.scard('mykey', function (err, res) {
    console.log(res); // 2
});
