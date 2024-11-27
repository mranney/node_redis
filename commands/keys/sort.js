'use strict';

var redis = require('redis');
var client = redis.createClient();

// sort: Sort the elements in a list, set or sorted set

client.rpush('mylist', 7, function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 1, function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 3, function (err, res) {
    console.log(res); // 3
});

client.lrange('mylist', -100, 100, function (err, res) {
    console.log(res); // [ '7', '1', '3' ]
});

client.sort('mylist', 'ALPHA', function (err, res) {
    console.log(res); // [ '1', '3', '7' ]
});
