'use strict';

var redis = require('redis');
var client = redis.createClient();

// lpushx: Prepend a value to a list, only if the list exists

client.lpush('mylist', 'World', function (err, res) {
    console.log(res); // 1
});

client.lpushx('mylist', 'Hello', function (err, res) {
    console.log(res); // 2
});

client.lpushx('myotherlist', 'Hello', function (err, res) {
    console.log(res); // 0
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'Hello', 'World' ]
});

client.lrange('myotherlist', 0, -1, function (err, res) {
    console.log(res); // []
});
