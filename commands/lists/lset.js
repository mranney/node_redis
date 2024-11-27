'use strict';

var redis = require('redis');
var client = redis.createClient();

// lset: Set the value of an element in a list by its index

client.rpush('mylist', 'one', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'two', function (err, res) {
    console.log(res); // 2
});

client.rpush('mylist', 'three', function (err, res) {
    console.log(res); // 3
});

client.lset('mylist',0, 'four', function (err, res) {
    console.log(res); // OK
});

client.lset('mylist',-2, 'five', function (err, res) {
    console.log(res); // OK
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'four', 'five', 'three' ]
});
