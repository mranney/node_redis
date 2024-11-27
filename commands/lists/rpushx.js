'use strict';

var redis = require('redis');
var client = redis.createClient();

// rpushx: Append a value to a list, only if the list exists

client.rpush('mylist', 'hello', function (err, res) {
    console.log(res); // 1
});

client.rpushx('mylist', 'world', function (err, res) {
    console.log(res); // 2
});

client.rpushx('myotherlist', 'world', function (err, res) {
    console.log(res); // 0
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'hello', 'world' ]
});

client.lrange('myotherlist', 0, -1, function (err, res) {
    console.log(res); // []
});
