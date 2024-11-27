'use strict';

var redis = require('redis');
var client = redis.createClient();

// lrem: Remove elements from a list

client.rpush('mylist', 'hello', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'hello', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'foo', function (err, res) {
    console.log(res); // 3
});

client.rpush('mylist', 'hello', function (err, res) {
    console.log(res); // 4
});

client.lrem('mylist', -2, 'hello', function (err, res) {
    console.log(res); // 2
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'hello', 'foo' ]
});
