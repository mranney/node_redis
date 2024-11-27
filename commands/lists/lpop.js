'use strict';

var redis = require('redis');
var client = redis.createClient();

// lpop: Remove and get the first element in a list

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.lpop('mylist', function (err, res) {
    console.log(res); // one
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'two', 'three' ]
});
