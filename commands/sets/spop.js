'use strict';

var redis = require('redis');
var client = redis.createClient();

// spop: Remove and return one or multiple random members from a set

client.sadd('myset', 'one', function (err, res) {
    console.log(res); // 1
});

client.sadd('myset', 'two', function (err, res) {
    console.log(res); // 1
});

client.sadd('myset', 'three', function (err, res) {
    console.log(res); // 1
});

client.spop('myset', function (err, res) {
    console.log(res); // one
});

client.smembers('myset', function (err, res) {
    console.log(res); // [ 'three', 'two' ]
});

client.sadd('myset', 'four', function (err, res) {
    console.log(res); // 1
});

client.sadd('myset', 'five', function (err, res) {
    console.log(res); // 1
});

client.spop('myset', function (err, res) {
    console.log(res); // four
});

client.smembers('myset', function (err, res) {
    console.log(res); // [ 'three', 'five', 'two' ]
});
