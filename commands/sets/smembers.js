'use strict';

var redis = require('redis');
var client = redis.createClient();

// smembers: Get all the members in a set

client.sadd('myset', 'Hello', function (err, res) {
    console.log(res); // 1
});

client.sadd('myset', 'World', function (err, res) {
    console.log(res); // 1
});

client.smembers('myset', function (err, res) {
    console.log(res); // [ 'Hello', 'World' ]
});
