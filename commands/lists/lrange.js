'use strict';

var redis = require('redis');
var client = redis.createClient();

// lrange: Get a range of elements from a list

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.lrange('mylist', 0, 0, function (err, res) {
    console.log(res); // [ 'one' ]
});

client.lrange('mylist', -3, 2, function (err, res) {
    console.log(res); // [ 'one', 'two', 'three' ]
});

client.lrange('mylist', -100, 100, function (err, res) {
    console.log(res); // [ 'one', 'two', 'three' ]
});

client.lrange('mylist', 5, 10, function (err, res) {
    console.log(res); // []
});
