'use strict';

var redis = require('redis');
var client = redis.createClient();

// llen: Get the length of a list

client.lpush('mylist', 'World', function (err, res) {
    console.log(res); // 1
});

client.lpush('mylist', 'Hello', function (err, res) {
    console.log(res); // 2
});

client.llen('mylist', function (err, res) {
    console.log(res); // 2
});
