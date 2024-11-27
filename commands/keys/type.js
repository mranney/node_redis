'use strict';

var redis = require('redis');
var client = redis.createClient();

// type: Determine the type stored at key

client.set('key1', 'value', function (err, res) {
    console.log(res); // OK
});

client.lpush('key2', 'value', function (err, res) {
    console.log(res); // 1
});

client.sadd('key3', 'value', function (err, res) {
    console.log(res); // 1
});

client.type('key1', function (err, res) {
    console.log(res); // string
});

client.type('key2', function (err, res) {
    console.log(res); // list
});

client.type('key3', function (err, res) {
    console.log(res); // set
});
