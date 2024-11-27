'use strict';

var redis = require('redis');
var client = redis.createClient();

// lindex: Get an element from a list by its index

client.lpush('mylist', 'World', function (err, res) {
    console.log(res); // 1
});

client.lpush('mylist', 'Hello', function (err, res) {
    console.log(res); // 2
});

client.lindex('mylist', 0, function (err, res) {
    console.log(res); // Hello
});

client.lindex('mylist', -1, function (err, res) {
    console.log(res); // World
});

client.lindex('mylist', 3, function (err, res) {
    console.log(res); // null
});
