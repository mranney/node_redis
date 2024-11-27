'use strict';

var redis = require('redis');
var client = redis.createClient();

// incrbyfloat: Increment the float value of a key by the given amount

client.set('mykey', 10.50, function (err, res) {
    console.log(res); // OK
});

client.incrbyfloat('mykey', 0.1, function (err, res) {
    console.log(res); // 10.6
});

client.incrbyfloat('mykey', -5, function (err, res) {
    console.log(res); // 5.6
});

client.set('mykey', 5.0e3, function (err, res) {
    console.log(res); // OK
});

client.incrbyfloat('mykey', 2.0e2, function (err, res) {
    console.log(res); // 5200
});
