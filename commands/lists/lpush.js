'use strict';

var redis = require('redis');
var client = redis.createClient();

// lpush: Prepend one or multiple values to a list

client.lpush('mylist', 'world', function (err, res) {
    console.log(res); // 1
});

client.lpush('mylist', 'hello', function (err, res) {
    console.log(res); // 2
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'hello', 'world' ]
});
