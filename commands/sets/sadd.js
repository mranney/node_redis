'use strict';

var redis = require('redis');
var client = redis.createClient();

// sadd: Add one or more members to a set

client.sadd('mykey', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.sadd('mykey', 'World', function (err, res) {
    console.log(res); // 1
});

client.sadd('mykey', 'World', function (err, res) {
    console.log(res); // 0
});

client.smembers('mykey', function (err, res) {
    console.log(res); // [ 'Hello', 'World' ]
});
