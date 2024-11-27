'use strict';

var redis = require('redis');
var client = redis.createClient();

// rpop: Remove and get the last element in a list

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.rpop('mylist', function (err, res) {
    console.log(res); // three
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'one', 'two' ]
});
