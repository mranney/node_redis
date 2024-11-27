'use strict';

var redis = require('redis');
var client = redis.createClient();

// brpop: Remove and get the last element in a list, or block until one is available

client.del('list1', 'list2', 0, function (err, res) {
    console.log(res); // 0
});

client.rpush('list1', 'a', 'b', 'c',function (err, res) {
    console.log(res); // 3
});

client.brpop('list1', 'list2', 0, function (err, res) {
    console.log(res); // [ 'list1', 'c' ]
});
