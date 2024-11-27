'use strict';

var redis = require('redis');
var client = redis.createClient();

// hincrbyfloat: Increment the float value of a hash field by the given amount

client.hset('mykey', 'field', 10.50, function (err, res) {
    console.log(res); // 1
});

client.hincrbyfloat('mykey', 'field', 0.1, function (err, res) {
    console.log(res); // 10.6
});

client.hincrbyfloat('mykey', 'field', -5, function (err, res) {
    console.log(res); // 5.6
});

client.hset('mykey', 'field', 5.0e3, function (err, res) {
    console.log(res); // 0
});

client.hincrbyfloat('mykey', 'field', 2.0e2, function (err, res) {
    console.log(res); // 5200
});
