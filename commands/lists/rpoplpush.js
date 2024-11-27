'use strict';

var redis = require('redis');
var client = redis.createClient();

// rpoplpush: Remove the last element in a list, prepend it to another list and return it

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.rpoplpush('mylist', 'myotherlist', function (err, res) {
    console.log(res); // three
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'one', 'two' ]
});

client.lrange('myotherlist', 0, -1, function (err, res) {
    console.log(res); // [ 'three' ]
});
