'use strict';

var redis = require('redis');
var client = redis.createClient();

// ltrim: Trim a list to the specified range

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.ltrim('mylist', 1, -1, function (err, res) {
    console.log(res); // OK
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'two', 'three' ]
});
